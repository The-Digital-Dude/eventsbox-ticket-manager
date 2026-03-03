import { NextRequest } from "next/server";
import { Role, StripeOnboardingStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { getStripeClient } from "@/src/lib/stripe/client";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const stripe = getStripeClient();
    const settings = await prisma.organizerPayoutSettings.upsert({
      where: { organizerProfileId: profile.id },
      update: {},
      create: { organizerProfileId: profile.id },
    });

    if (!stripe) {
      const mockedUrl = `${env.APP_URL}/mocked/stripe/onboarding/${profile.id}`;
      await prisma.organizerPayoutSettings.update({
        where: { id: settings.id },
        data: { payoutMode: "STRIPE_CONNECT", stripeOnboardingStatus: StripeOnboardingStatus.PENDING },
      });
      return ok({ url: mockedUrl, mocked: true });
    }

    let accountId = settings.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({ type: "express", email: auth.email });
      accountId = account.id;
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${env.APP_URL}/organizer/payout`,
      return_url: `${env.APP_URL}/organizer/payout`,
      type: "account_onboarding",
    });

    await prisma.organizerPayoutSettings.update({
      where: { id: settings.id },
      data: {
        stripeAccountId: accountId,
        payoutMode: "STRIPE_CONNECT",
        stripeOnboardingStatus: StripeOnboardingStatus.PENDING,
      },
    });

    return ok({ url: link.url, mocked: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Stripe onboarding";
    console.error("Stripe onboarding error:", error);
    return fail(500, { code: "INTERNAL_ERROR", message });
  }
}
