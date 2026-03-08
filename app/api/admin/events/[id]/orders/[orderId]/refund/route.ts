import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { refundPaidOrder } from "@/src/lib/services/order-refund";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id, orderId } = await params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, eventId: id },
      select: { id: true },
    });
    if (!order) return fail(404, { code: "NOT_FOUND", message: "Order not found" });

    const refunded = await refundPaidOrder(orderId);
    if (!refunded.success) {
      if (refunded.error.code === "NOT_FOUND") {
        return fail(404, { code: refunded.error.code, message: refunded.error.message });
      }
      if (refunded.error.code === "STRIPE_UNAVAILABLE" || refunded.error.code === "STRIPE_REFUND_FAILED") {
        return fail(500, { code: refunded.error.code, message: refunded.error.message });
      }
      return fail(400, { code: refunded.error.code, message: refunded.error.message });
    }

    return ok(refunded.data);
  } catch (error) {
    console.error("[app/api/admin/events/[id]/orders/[orderId]/refund/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to refund order" });
  }
}
