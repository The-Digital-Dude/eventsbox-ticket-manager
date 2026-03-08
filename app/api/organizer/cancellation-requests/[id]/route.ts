import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { sendCancellationRejectedEmail } from "@/src/lib/services/notifications";
import { refundPaidOrder } from "@/src/lib/services/order-refund";
import { writeAuditLog } from "@/src/lib/services/audit";

const cancellationDecisionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  adminNote: z.string().trim().max(1000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;

    const parsed = cancellationDecisionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid cancellation action payload",
        details: parsed.error.flatten(),
      });
    }

    const request = await prisma.cancellationRequest.findFirst({
      where: {
        id,
        order: {
          event: {
            organizerProfile: {
              userId: auth.sub,
            },
          },
        },
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        order: {
          select: {
            id: true,
            buyerEmail: true,
            buyerName: true,
            event: { select: { title: true } },
          },
        },
      },
    });

    if (!request) {
      return fail(404, { code: "NOT_FOUND", message: "Cancellation request not found" });
    }

    if (request.status !== "PENDING") {
      return fail(400, { code: "ALREADY_RESOLVED", message: "Cancellation request is already resolved" });
    }

    if (parsed.data.action === "APPROVE") {
      const refunded = await refundPaidOrder(request.order.id, { allowAnyEventStatus: true });
      if (!refunded.success) {
        if (refunded.error.code === "NOT_FOUND") {
          return fail(404, { code: refunded.error.code, message: refunded.error.message });
        }
        if (refunded.error.code === "STRIPE_UNAVAILABLE" || refunded.error.code === "STRIPE_REFUND_FAILED") {
          return fail(500, { code: refunded.error.code, message: refunded.error.message });
        }
        return fail(400, { code: refunded.error.code, message: refunded.error.message });
      }

      const updated = await prisma.cancellationRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          adminNote: parsed.data.adminNote || null,
          resolvedAt: new Date(),
        },
      });

      await writeAuditLog({
        actorUserId: auth.sub,
        action: "CANCELLATION_REQUEST_APPROVED",
        entityType: "CancellationRequest",
        entityId: request.id,
        metadata: {
          orderId: request.orderId,
          refundStatus: refunded.data.status,
          refundId: refunded.data.refundId,
        },
      });

      return ok(updated);
    }

    const updated = await prisma.cancellationRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        adminNote: parsed.data.adminNote || null,
        resolvedAt: new Date(),
      },
    });

    await sendCancellationRejectedEmail({
      to: request.order.buyerEmail,
      buyerName: request.order.buyerName,
      eventTitle: request.order.event.title,
      orderId: request.order.id,
      adminNote: parsed.data.adminNote || null,
    });

    await writeAuditLog({
      actorUserId: auth.sub,
      action: "CANCELLATION_REQUEST_REJECTED",
      entityType: "CancellationRequest",
      entityId: request.id,
      metadata: {
        orderId: request.orderId,
        adminNote: parsed.data.adminNote || null,
      },
    });

    return ok(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
    }

    console.error("[app/api/organizer/cancellation-requests/[id]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to process cancellation request" });
  }
}
