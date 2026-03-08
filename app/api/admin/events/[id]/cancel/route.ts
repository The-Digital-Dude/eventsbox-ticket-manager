import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { env } from "@/src/lib/env";
import { notifyAttendeesOfEventCancellation, sendOrganizerEventStatusEmail } from "@/src/lib/services/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        organizerProfile: { select: { user: { select: { email: true } } } },
      },
    });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    if (event.status !== "PUBLISHED") {
      return fail(400, { code: "INVALID_STATUS", message: "Only PUBLISHED events can be cancelled" });
    }

    const paidOrdersCount = await prisma.order.count({ where: { eventId: id, status: "PAID" } });

    const updated = await prisma.event.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, status: true },
    });

    await sendOrganizerEventStatusEmail({
      to: event.organizerProfile.user.email,
      eventTitle: event.title,
      status: "CANCELLED",
      eventUrl: `${env.APP_URL}/organizer/events/${id}`,
    });
    await notifyAttendeesOfEventCancellation(id);

    return ok({ ...updated, paidOrdersCount });
  } catch (error) {
    console.error("[app/api/admin/events/[id]/cancel/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to cancel event" });
  }
}
