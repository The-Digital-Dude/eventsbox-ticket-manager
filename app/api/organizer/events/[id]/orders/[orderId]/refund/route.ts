import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { refundPaidOrder } from "@/src/lib/services/order-refund";
import { notifyWaitlist } from "@/src/lib/services/waitlist";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id, orderId } = await params;

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        eventId: id,
        event: { organizerProfileId: profile.id },
      },
      select: {
        id: true,
        items: {
          select: {
            ticketTypeId: true,
            quantity: true,
          },
        },
      },
    });
    if (!order) return fail(404, { code: "NOT_FOUND", message: "Order not found" });

    const refunded = await refundPaidOrder(orderId, { allowAnyEventStatus: true });
    if (!refunded.success) {
      if (refunded.error.code === "NOT_FOUND") {
        return fail(404, { code: refunded.error.code, message: refunded.error.message });
      }
      if (refunded.error.code === "STRIPE_UNAVAILABLE" || refunded.error.code === "STRIPE_REFUND_FAILED") {
        return fail(500, { code: refunded.error.code, message: refunded.error.message });
      }
      return fail(400, { code: refunded.error.code, message: refunded.error.message });
    }

    for (const item of order.items) {
      void notifyWaitlist(item.ticketTypeId, item.quantity).catch((error) => {
        console.error("[app/api/organizer/events/[id]/orders/[orderId]/refund/route.ts][notifyWaitlist]", error);
      });
    }

    return ok(refunded.data);
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/orders/[orderId]/refund/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to refund order" });
  }
}
