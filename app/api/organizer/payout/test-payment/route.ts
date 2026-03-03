import { NextRequest } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/src/lib/db";
import { requireApprovedOrganizer } from "@/src/lib/auth/guards";
import { env } from "@/src/lib/env";
import { fail, ok } from "@/src/lib/http/response";
import { getStripeClient } from "@/src/lib/stripe/client";
import { payoutTestPaymentSchema } from "@/src/lib/validators/organizer";

function toMinorUnits(amount: number) {
  return Math.round(amount * 100);
}

function formatPct(value: number) {
  return value.toFixed(2);
}

function getExpandedPaymentIntent(session: Stripe.Checkout.Session) {
  if (!session.payment_intent || typeof session.payment_intent === "string") {
    return null;
  }

  return session.payment_intent;
}

function getConnectedAccountState(account: Stripe.Account | Stripe.DeletedAccount | null) {
  if (!account || ("deleted" in account && account.deleted)) {
    return {
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirementsDisabledReason: null as string | null,
    };
  }

  return {
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirementsDisabledReason: account.requirements?.disabled_reason ?? null,
  };
}

async function loadOrganizerStripeState(userId: string, stripe: Stripe | null) {
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId },
    include: { payoutSettings: true },
  });

  if (!profile) {
    return null;
  }

  const platformConfig = await prisma.platformConfig.findUnique({ where: { id: "singleton" } });
  const connectedAccount =
    stripe && profile.payoutSettings?.stripeAccountId
      ? await stripe.accounts.retrieve(profile.payoutSettings.stripeAccountId)
      : null;

  return {
    profile,
    defaultCommissionPct: Number(platformConfig?.defaultCommissionPct ?? 0),
    connectedAccountState: getConnectedAccountState(connectedAccount),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { payload } = await requireApprovedOrganizer(req);
    const stripe = getStripeClient();
    const loaded = await loadOrganizerStripeState(payload.sub, stripe);

    if (!loaded) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const sessionId = req.nextUrl.searchParams.get("session_id") ?? req.nextUrl.searchParams.get("sessionId");
    let sessionSummary: Record<string, unknown> | null = null;

    if (stripe && sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });

      if (session.metadata?.organizerProfileId !== loaded.profile.id) {
        return fail(403, { code: "FORBIDDEN", message: "This checkout session does not belong to the current organizer" });
      }

      const paymentIntent = getExpandedPaymentIntent(session);
      const grossAmount = session.amount_total ?? 0;
      const applicationFeeAmount = paymentIntent?.application_fee_amount ?? null;

      sessionSummary = {
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        currency: session.currency,
        grossAmount,
        applicationFeeAmount,
        organizerNetAmount:
          applicationFeeAmount === null
            ? null
            : Math.max(grossAmount - applicationFeeAmount, 0),
        connectedAccountId:
          paymentIntent?.transfer_data?.destination ??
          loaded.profile.payoutSettings?.stripeAccountId ??
          null,
        paymentIntentId: paymentIntent?.id ?? null,
      };
    }

    return ok({
      stripeConfigured: Boolean(stripe),
      defaultCommissionPct: loaded.defaultCommissionPct,
      payoutSettings: {
        payoutMode: loaded.profile.payoutSettings?.payoutMode ?? null,
        stripeAccountId: loaded.profile.payoutSettings?.stripeAccountId ?? null,
        stripeOnboardingStatus: loaded.profile.payoutSettings?.stripeOnboardingStatus ?? null,
        ...loaded.connectedAccountState,
      },
      session: sessionSummary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load payout test state";
    return fail(500, { code: "INTERNAL_ERROR", message });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { payload } = await requireApprovedOrganizer(req);
    const stripe = getStripeClient();

    if (!stripe) {
      return fail(400, {
        code: "STRIPE_NOT_CONFIGURED",
        message: "Stripe is not configured for this environment",
      });
    }

    const parsed = payoutTestPaymentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid test payment payload",
        details: parsed.error.flatten(),
      });
    }

    const loaded = await loadOrganizerStripeState(payload.sub, stripe);
    if (!loaded) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const stripeAccountId = loaded.profile.payoutSettings?.stripeAccountId;
    if (!stripeAccountId) {
      return fail(400, {
        code: "STRIPE_ACCOUNT_REQUIRED",
        message: "Connect a Stripe account before testing split payments",
      });
    }

    if (!loaded.connectedAccountState.chargesEnabled) {
      return fail(400, {
        code: "CONNECTED_ACCOUNT_NOT_READY",
        message:
          loaded.connectedAccountState.requirementsDisabledReason
            ? `Stripe account is not ready to accept charges yet (${loaded.connectedAccountState.requirementsDisabledReason})`
            : "Finish Stripe onboarding in Stripe before testing payments",
      });
    }

    const feePct = parsed.data.platformFeePct ?? loaded.defaultCommissionPct;
    const grossAmount = toMinorUnits(parsed.data.amount);
    const applicationFeeAmount = Math.min(toMinorUnits(parsed.data.amount * (feePct / 100)), grossAmount);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: payload.email,
      success_url: `${env.APP_URL}/organizer/payout/test?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/organizer/payout/test?canceled=1`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: grossAmount,
            product_data: {
              name: parsed.data.description,
              description: `Platform fee ${formatPct(feePct)}% with destination charge to ${stripeAccountId}`,
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: stripeAccountId,
        },
        metadata: {
          organizerProfileId: loaded.profile.id,
          stripeAccountId,
          platformFeePct: formatPct(feePct),
        },
      },
      metadata: {
        organizerProfileId: loaded.profile.id,
        stripeAccountId,
        platformFeePct: formatPct(feePct),
      },
    });

    return ok({
      id: session.id,
      url: session.url,
      grossAmount,
      applicationFeeAmount,
      organizerNetAmount: Math.max(grossAmount - applicationFeeAmount, 0),
      connectedAccountId: stripeAccountId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create test payment";
    console.error("Stripe test payment error:", error);
    return fail(500, { code: "INTERNAL_ERROR", message });
  }
}
