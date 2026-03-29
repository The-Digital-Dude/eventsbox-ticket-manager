import { NextRequest } from "next/server";
import { PayoutRequestStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { getStripeClient } from "@/src/lib/stripe/client";

function isAuthorizedCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedCron(req)) {
      return fail(401, { code: "UNAUTHORIZED", message: "Cron authorization failed" });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return fail(500, { code: "STRIPE_NOT_CONFIGURED", message: "Stripe is not configured" });
    }

    const profiles = await prisma.organizerProfile.findMany({
      where: {
        payoutSettings: {
          payoutMode: "AUTO",
          stripeAccountId: { not: null },
        },
      },
      select: {
        id: true,
        payoutSettings: {
          select: {
            stripeAccountId: true,
          },
        },
      },
    });

    let processed = 0;
    let skipped = 0;

    for (const profile of profiles) {
      const lastPayout = await prisma.payoutRequest.findFirst({
        where: {
          organizerProfileId: profile.id,
          status: PayoutRequestStatus.PAID,
        },
        orderBy: { resolvedAt: "desc" },
      });

      const since = lastPayout?.resolvedAt ?? new Date(0);
      const result = await prisma.order.aggregate({
        where: {
          event: {
            organizerProfileId: profile.id,
          },
          status: "PAID",
          paidAt: { gt: since },
        },
        _sum: { total: true },
      });

      const balance = Number(result._sum.total ?? 0);
      if (balance < 100 || !profile.payoutSettings?.stripeAccountId) {
        skipped += 1;
        continue;
      }

      const payoutAmount = Number((balance * 0.915).toFixed(2));
      const payoutRequest = await prisma.payoutRequest.create({
        data: {
          organizerProfileId: profile.id,
          amount: payoutAmount,
          note: "Auto-payout",
          status: PayoutRequestStatus.APPROVED,
        },
      });

      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(payoutAmount * 100),
          currency: "usd",
          destination: profile.payoutSettings.stripeAccountId,
          metadata: { payoutRequestId: payoutRequest.id },
        });

        await prisma.payoutRequest.update({
          where: { id: payoutRequest.id },
          data: {
            status: PayoutRequestStatus.PAID,
            stripeTransferId: transfer.id,
            resolvedAt: new Date(),
            failureReason: null,
          },
        });

        processed += 1;
      } catch (error) {
        await prisma.payoutRequest.update({
          where: { id: payoutRequest.id },
          data: {
            failureReason: error instanceof Error ? error.message : "Stripe transfer failed",
          },
        });
        skipped += 1;
      }
    }

    return ok({ processed, skipped });
  } catch (error) {
    console.error("[app/api/cron/auto-payouts/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to process auto payouts" });
  }
}
