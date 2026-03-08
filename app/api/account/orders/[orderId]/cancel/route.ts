import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { fail, ok } from "@/src/lib/http/response";
import { sendOrganizerCancellationRequestEmail } from "@/src/lib/services/notifications";

const cancellationRequestSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

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
        event: {
          select: {
            title: true,
            contactEmail: true,
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

    const request = await prisma.cancellationRequest.create({
      data: {
        orderId: order.id,
        attendeeUserId: attendeeProfile.id,
        reason: parsed.data.reason?.trim() || null,
        status: "PENDING",
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (order.event.contactEmail) {
      void sendOrganizerCancellationRequestEmail({
        to: order.event.contactEmail,
        attendeeEmail: session.user.email,
        eventTitle: order.event.title,
        orderId: order.id,
        reason: parsed.data.reason,
      }).catch((error) => {
        console.error("[app/api/account/orders/[orderId]/cancel/route.ts][notify]", error);
      });
    }

    return ok({ requestId: request.id, status: request.status });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Attendee access required" });
    }

    console.error("[app/api/account/orders/[orderId]/cancel/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to create cancellation request" });
  }
}
