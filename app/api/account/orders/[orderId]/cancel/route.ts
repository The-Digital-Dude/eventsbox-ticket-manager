import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { fail, ok } from "@/src/lib/http/response";
import { getStripeClient } from "@/src/lib/stripe/client";
import { sendOrderRefundedEmail } from "@/src/lib/services/notifications";

const cancellationRequestSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

function calculateRefundAmount(totalCents: number, refundPercent: number): number {
  return Math.round(totalCents * (refundPercent / 100));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await requireAttendee(req);
    const { orderId } = await params;

    const attendeeProfile = await prisma.attendeeProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!attendeeProfile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Attendee profile not found" });
    }

    const parsed = cancellationRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid cancellation payload",
        details: parsed.error.flatten(),
      });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        attendeeUserId: attendeeProfile.id,
        status: "PAID",
      },
      select: {
        id: true,
        buyerEmail: true,
        buyerName: true,
        total: true,
        stripePaymentIntentId: true,
        event: {
          select: {
            title: true,
            contactEmail: true,
            cancellationDeadlineHours: true,
            refundPercent: true,
            startAt: true,
          },
        },
        cancellationRequest: {
          select: { id: true },
        },
      },
    });
    if (!order) {
      return fail(404, { code: "NOT_FOUND", message: "Paid order not found for attendee" });
    }

    if (order.cancellationRequest) {
      return fail(409, { code: "ALREADY_REQUESTED", message: "Cancellation already requested for this order" });
    }

    const { event } = order;

    // Check if cancellations are allowed at all
    if (event.cancellationDeadlineHours === null) {
      return fail(400, { code: "NOT_ALLOWED", message: "Cancellations are not allowed for this event" });
    }

    // Check if deadline has passed
    const deadlineMs = event.startAt.getTime() - event.cancellationDeadlineHours * 3600 * 1000;
    if (Date.now() > deadlineMs) {
      return fail(400, { code: "DEADLINE_PASSED", message: "Cancellation deadline has passed" });
    }

    // Auto-process: issue Stripe refund if payment intent exists
    const totalCents = Math.round(Number(order.total) * 100);
    const refundAmountCents = calculateRefundAmount(totalCents, event.refundPercent);

    if (order.stripePaymentIntentId && refundAmountCents > 0) {
      const stripe = getStripeClient();
      if (!stripe) {
        return fail(500, { code: "STRIPE_UNAVAILABLE", message: "Refund processing is unavailable" });
      }
      try {
        await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount: refundAmountCents,
        });
      } catch (stripeError) {
        console.error("[app/api/account/orders/[orderId]/cancel/route.ts][stripe]", stripeError);
        return fail(500, { code: "REFUND_FAILED", message: "Refund processing failed" });
      }
    }

    // Update order to CANCELLED and upsert CancellationRequest as APPROVED
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      }),
      prisma.cancellationRequest.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          attendeeUserId: attendeeProfile.id,
          reason: parsed.data.reason?.trim() || null,
          status: "APPROVED",
          resolvedAt: new Date(),
        },
        update: {
          status: "APPROVED",
          resolvedAt: new Date(),
        },
      }),
    ]);

    // Send cancellation/refund email
    void sendOrderRefundedEmail({
      to: order.buyerEmail,
      buyerName: order.buyerName,
      eventTitle: event.title,
      orderId: order.id,
      total: Number(order.total) * (event.refundPercent / 100),
    }).catch((error) => {
      console.error("[app/api/account/orders/[orderId]/cancel/route.ts][notify]", error);
    });

    return ok({ refunded: true, refundPct: event.refundPercent });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Attendee access required" });
    }

    console.error("[app/api/account/orders/[orderId]/cancel/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to process cancellation" });
  }
}
