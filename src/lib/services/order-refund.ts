import { prisma } from "@/src/lib/db";
import { getStripeClient } from "@/src/lib/stripe/client";
import { sendOrderRefundedEmail } from "@/src/lib/services/notifications";

type RefundErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "EVENT_NOT_CANCELLED"
  | "MISSING_PAYMENT_INTENT"
  | "STRIPE_UNAVAILABLE"
  | "STRIPE_REFUND_FAILED";

type RefundResult =
  | {
      success: true;
      data: {
        orderId: string;
        status: "REFUNDED";
        refundId: string;
      };
    }
  | {
      success: false;
      error: {
        code: RefundErrorCode;
        message: string;
      };
    };

export async function refundPaidOrder(
  orderId: string,
  options?: { allowAnyEventStatus?: boolean },
): Promise<RefundResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      event: { select: { status: true, title: true } },
      items: { select: { ticketTypeId: true, quantity: true } },
    },
  });

  if (!order) {
    return { success: false, error: { code: "NOT_FOUND", message: "Order not found" } };
  }

  if (order.status !== "PAID") {
    return {
      success: false,
      error: { code: "INVALID_STATUS", message: "Only PAID orders can be refunded" },
    };
  }

  if (!options?.allowAnyEventStatus && order.event.status !== "CANCELLED") {
    return {
      success: false,
      error: { code: "EVENT_NOT_CANCELLED", message: "Order can be refunded only when event is cancelled" },
    };
  }

  if (!order.stripePaymentIntentId) {
    return {
      success: false,
      error: { code: "MISSING_PAYMENT_INTENT", message: "Missing Stripe payment reference for this order" },
    };
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return {
      success: false,
      error: { code: "STRIPE_UNAVAILABLE", message: "Payment system unavailable" },
    };
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      metadata: { orderId: order.id, eventId: order.eventId },
    });

    if (refund.status === "failed" || refund.status === "canceled") {
      return {
        success: false,
        error: { code: "STRIPE_REFUND_FAILED", message: "Stripe refund did not complete successfully" },
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED" },
      });

      for (const item of order.items) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { sold: { decrement: item.quantity } },
        });
      }
    });

    await sendOrderRefundedEmail({
      to: order.buyerEmail,
      buyerName: order.buyerName,
      eventTitle: order.event.title,
      orderId: order.id,
      total: Number(order.total),
    });

    return {
      success: true,
      data: {
        orderId: order.id,
        status: "REFUNDED",
        refundId: refund.id,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed";
    return {
      success: false,
      error: { code: "STRIPE_REFUND_FAILED", message },
    };
  }
}
