import { headers } from "next/headers";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { fail, ok } from "@/src/lib/http/response";
import { env } from "@/src/lib/env";
import { getStripeClient } from "@/src/lib/stripe/client";
import { prisma } from "@/src/lib/db";

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return ok({ received: true, mocked: true });
  }

  try {
    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");
    if (!signature) {
      return fail(400, { code: "MISSING_SIGNATURE", message: "Missing stripe signature" });
    }

    const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      if (account.id) {
        await prisma.organizerPayoutSettings.updateMany({
          where: { stripeAccountId: account.id },
          data: {
            stripeOnboardingStatus: account.details_submitted ? "COMPLETED" : "PENDING",
          },
        });
      }
    }

    return ok({ received: true });
  } catch {
    return fail(400, { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" });
  }
}
