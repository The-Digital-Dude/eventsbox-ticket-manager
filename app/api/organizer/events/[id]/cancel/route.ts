import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { organizerEventCancelSchema } from "@/src/lib/validators/event";
import { notifyAttendeesOfEventCancellation } from "@/src/lib/services/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;

    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
      select: { id: true, status: true },
    });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    if (event.status !== "PUBLISHED") {
      return fail(400, { code: "INVALID_STATUS", message: "Only PUBLISHED events can be cancelled" });
    }

    const parsed = organizerEventCancelSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid cancel payload", details: parsed.error.flatten() });
    }

    const paidOrdersCount = await prisma.order.count({ where: { eventId: id, status: "PAID" } });
    if (paidOrdersCount > 0 && !parsed.data.acknowledgePaidOrders) {
      return fail(400, {
        code: "PAID_ORDERS_EXIST",
        message: "This event has paid orders. Confirm acknowledgement before cancelling.",
        details: { paidOrdersCount },
      });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, status: true },
    });

    await notifyAttendeesOfEventCancellation(id);

    return ok({ ...updated, paidOrdersCount });
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to cancel event" });
  }
}
