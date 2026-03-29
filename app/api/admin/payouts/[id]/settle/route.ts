import { NextRequest } from "next/server";
import { PayoutRequestStatus, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { writeAuditLog } from "@/src/lib/services/audit";
import { getStripeClient } from "@/src/lib/stripe/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;

    const payoutRequest = await prisma.payoutRequest.findUnique({
      where: { id },
      include: {
        organizerProfile: {
          include: {
            payoutSettings: true,
          },
        },
      },
    });

    if (!payoutRequest) {
      return fail(404, { code: "NOT_FOUND", message: "Payout request not found" });
    }

    if (payoutRequest.status !== PayoutRequestStatus.APPROVED) {
      return fail(400, { code: "INVALID_STATUS", message: "Only approved payout requests can be settled" });
    }

    if (!payoutRequest.amount || Number(payoutRequest.amount) <= 0) {
      return fail(400, { code: "INVALID_AMOUNT", message: "Payout request amount must be greater than zero" });
    }

    const stripeAccountId = payoutRequest.organizerProfile.payoutSettings?.stripeAccountId;
    if (!stripeAccountId) {
      return fail(400, {
        code: "NO_STRIPE_ACCOUNT",
        message: "Organizer has not completed Stripe Connect onboarding.",
      });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return fail(500, { code: "STRIPE_NOT_CONFIGURED", message: "Stripe is not configured" });
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(payoutRequest.amount) * 100),
        currency: "usd",
        destination: stripeAccountId,
        metadata: { payoutRequestId: id },
      });

      await prisma.payoutRequest.update({
        where: { id },
        data: {
          status: PayoutRequestStatus.PAID,
          stripeTransferId: transfer.id,
          failureReason: null,
          resolvedAt: new Date(),
        },
      });

      await writeAuditLog({
        actorUserId: admin.sub,
        action: "PAYOUT_SETTLED",
        entityType: "PayoutRequest",
        entityId: id,
        metadata: { stripeTransferId: transfer.id },
      });

      return ok({ stripeTransferId: transfer.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe transfer failed";

      await prisma.payoutRequest.update({
        where: { id },
        data: {
          failureReason: message,
        },
      });

      return fail(502, { code: "STRIPE_ERROR", message });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Admin only" });
    }

    console.error("[app/api/admin/payouts/[id]/settle/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to settle payout request" });
  }
}
