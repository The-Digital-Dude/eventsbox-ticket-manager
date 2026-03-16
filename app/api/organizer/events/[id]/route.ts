import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { eventUpdateSchema } from "@/src/lib/validators/event";
import { sendEventDateChangedEmail } from "@/src/lib/services/notifications";

const eventInclude = {
  category: { select: { id: true, name: true } },
  venue: { select: { id: true, name: true, addressLine1: true, seatingConfig: true } },
  state: { select: { id: true, name: true } },
  city: { select: { id: true, name: true } },
  series: { select: { id: true, title: true } },
  ticketTypes: { orderBy: { sortOrder: "asc" as const } },
  _count: { select: { orders: true, waitlist: true } },
  orders: {
    where: { status: "PAID" as const },
    select: { total: true, platformFee: true, gst: true },
  },
};

async function getOwnEvent(id: string, organizerProfileId: string) {
  return prisma.event.findFirst({ where: { id, organizerProfileId }, include: eventInclude });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await getOwnEvent(id, profile.id);
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: "Event", entityId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        createdAt: true,
        actor: {
          select: {
            role: true,
            email: true,
          },
        },
      },
      take: 25,
    });

    return ok({
      ...event,
      auditLogs,
    });
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const existing = await getOwnEvent(id, profile.id);
    if (!existing) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    if (!["DRAFT", "REJECTED"].includes(existing.status)) {
      return fail(400, { code: "NOT_EDITABLE", message: "Only DRAFT or REJECTED events can be edited" });
    }

    const parsed = eventUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid update data", details: parsed.error.flatten() });
    }

    const { startAt, endAt, heroImage, contactEmail, images, seriesId, ...rest } = parsed.data;

    if (seriesId !== undefined && seriesId !== null) {
      const ownedSeries = await prisma.eventSeries.findFirst({
        where: { id: seriesId, organizerProfileId: profile.id },
        select: { id: true },
      });
      if (!ownedSeries) {
        return fail(404, { code: "SERIES_NOT_FOUND", message: "Series not found" });
      }
    }

    const oldStartAt = existing.startAt;

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...rest,
        ...(heroImage !== undefined ? { heroImage: heroImage || null } : {}),
        ...(images !== undefined ? { images } : {}),
        ...(contactEmail !== undefined ? { contactEmail: contactEmail || null } : {}),
        ...(startAt ? { startAt: new Date(startAt) } : {}),
        ...(endAt ? { endAt: new Date(endAt) } : {}),
        ...(seriesId !== undefined ? { seriesId } : {}),
      },
      include: eventInclude,
    });

    if (oldStartAt.getTime() !== event.startAt.getTime()) {
      const orders = await prisma.order.findMany({
        where: { eventId: event.id, status: "PAID" },
        select: { id: true, buyerEmail: true, buyerName: true },
      });

      sendEventDateChangedEmail({
        eventTitle: event.title,
        oldStartAt,
        newStartAt: event.startAt,
        timezone: event.timezone,
        venueName: event.venue?.name ?? null,
        attendees: orders.map((o) => ({ email: o.buyerEmail, name: o.buyerName, orderId: o.id })),
      }).catch((err) => console.error("[date-change-email]", err));
    }

    return ok(event);
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to update event" });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const existing = await getOwnEvent(id, profile.id);
    if (!existing) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    if (existing.status !== "DRAFT") {
      return fail(400, { code: "NOT_DELETABLE", message: "Only DRAFT events can be deleted" });
    }

    await prisma.event.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to delete event" });
  }
}
