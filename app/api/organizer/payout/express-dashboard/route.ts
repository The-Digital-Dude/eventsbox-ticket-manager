import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { getStripeClient } from "@/src/lib/stripe/client";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      include: { payoutSettings: true },
    });

    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const stripeAccountId = profile.payoutSettings?.stripeAccountId;
    if (!stripeAccountId) {
      return fail(400, { code: "STRIPE_ACCOUNT_REQUIRED", message: "No Stripe account connected yet" });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return fail(400, { code: "STRIPE_NOT_CONFIGURED", message: "Stripe is not configured for this environment" });
    }

    const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);
    return ok({ url: loginLink.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open Stripe Express dashboard";
    console.error("Stripe Express dashboard error:", error);
    return fail(500, { code: "INTERNAL_ERROR", message });
  }
}
