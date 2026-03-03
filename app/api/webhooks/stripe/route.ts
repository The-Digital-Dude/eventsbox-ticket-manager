import { NextRequest } from "next/server";
import { StripeOnboardingStatus } from "@prisma/client";
import Stripe from "stripe";
import { fail, ok } from "@/src/lib/http/response";
import { env } from "@/src/lib/env";
import { getStripeClient } from "@/src/lib/stripe/client";
import { prisma } from "@/src/lib/db";

function getWebhookSecrets() {
  return [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  );
}

function constructEventWithKnownSecrets(stripe: Stripe, body: string, signature: string) {
  const secrets = getWebhookSecrets();
  let lastSignatureError: Error | null = null;

  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(body, signature, secret);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        lastSignatureError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastSignatureError ?? new Error("No Stripe webhook secrets configured");
}

async function syncConnectedAccount(account: Stripe.Account) {
  if (!account.id) {
    return;
  }

  const stripeOnboardingStatus =
    account.details_submitted || (account.charges_enabled && account.payouts_enabled)
      ? StripeOnboardingStatus.COMPLETED
      : StripeOnboardingStatus.PENDING;

  await prisma.organizerPayoutSettings.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      stripeOnboardingStatus,
    },
  });
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await syncConnectedAccount(account);
      return;
    }
    case "account.application.deauthorized": {
      if (!event.account) {
        return;
      }

      await prisma.organizerPayoutSettings.updateMany({
        where: { stripeAccountId: event.account },
        data: {
          stripeAccountId: null,
          stripeOnboardingStatus: StripeOnboardingStatus.NOT_STARTED,
          payoutMode: "MANUAL",
        },
      });
      return;
    }
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
      return;
    default:
      return;
  }
}

export async function GET() {
  const stripe = getStripeClient();
  const recentEvents = await prisma.stripeWebhookEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      stripeEventId: true,
      type: true,
      livemode: true,
      processedAt: true,
      lastError: true,
      createdAt: true,
    },
  });

  return ok({
    stripeConfigured: Boolean(stripe),
    webhookSecretConfigured: getWebhookSecrets().length > 0,
    webhookSecretCount: getWebhookSecrets().length,
    endpoint: "/api/webhooks/stripe",
    recentEvents,
  });
}

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  if (!stripe || getWebhookSecrets().length === 0) {
    return ok({ received: true, mocked: true });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return fail(400, { code: "MISSING_SIGNATURE", message: "Missing stripe signature" });
    }

    const event = constructEventWithKnownSecrets(stripe, body, signature);
    const existing = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
      select: { id: true, processedAt: true },
    });

    if (existing?.processedAt) {
      return ok({ received: true, duplicate: true, eventId: event.id });
    }

    await prisma.stripeWebhookEvent.upsert({
      where: { stripeEventId: event.id },
      update: {
        type: event.type,
        livemode: event.livemode,
        payload: event as unknown as object,
        lastError: null,
      },
      create: {
        stripeEventId: event.id,
        type: event.type,
        livemode: event.livemode,
        payload: event as unknown as object,
      },
    });

    await handleStripeEvent(event);

    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: {
        processedAt: new Date(),
        lastError: null,
      },
    });

    return ok({ received: true, eventId: event.id });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return fail(400, { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" });
    }

    const maybeEventId =
      typeof error === "object" &&
      error !== null &&
      "raw" in error &&
      typeof (error as { raw?: { id?: string } }).raw?.id === "string"
        ? (error as { raw?: { id?: string } }).raw?.id
        : undefined;

    if (maybeEventId) {
      await prisma.stripeWebhookEvent.updateMany({
        where: { stripeEventId: maybeEventId },
        data: {
          lastError: error instanceof Error ? error.message : "Unknown webhook processing error",
        },
      });
    }

    console.error("Stripe webhook processing error:", error);
    return fail(500, {
      code: "WEBHOOK_PROCESSING_FAILED",
      message: error instanceof Error ? error.message : "Stripe webhook processing failed",
    });
  }
}
