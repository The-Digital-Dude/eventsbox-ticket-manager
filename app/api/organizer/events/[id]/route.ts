import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { resolveLocationIds } from "@/src/lib/location-resolution";
import { eventUpdateSchema } from "@/src/lib/validators/event";
import { serializeTicketClasses } from "@/src/lib/ticket-classes";
import { getReviewAttendeeName } from "@/src/lib/services/event-reviews";
import { sendEventDateChangedEmail } from "@/src/lib/services/notifications";

const eventSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  publishedAt: true,
  heroImage: true,
  description: true,
  eventLocationType: true,
  location: true,
  startAt: true,
  endAt: true,
  timezone: true,
  contactEmail: true,
  contactPhone: true,
  cancelPolicy: true,
  refundPolicy: true,
  customConfirmationMessage: true,
  commissionPct: true,
  gstPct: true,
  platformFeeFixed: true,
  rejectionReason: true,
  category: { select: { id: true, name: true } },
  venue: { select: { id: true, name: true, addressLine1: true, seatingConfig: true } },
  state: { select: { id: true, name: true } },
  city: { select: { id: true, name: true } },
  series: { select: { id: true, title: true } },
  ticketTypes: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      eventId: true,
      sectionId: true,
      eventSeatingSectionId: true,
      name: true,
      description: true,
      kind: true,
      classType: true,
      price: true,
      quantity: true,
      sold: true,
      reservedQty: true,
      compIssued: true,
      maxPerOrder: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  _count: { select: { orders: true, waitlist: true } },
  orders: {
    where: { status: "PAID" as const },
    select: { total: true, platformFee: true, gst: true },
  },
  reviews: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      rating: true,
      comment: true,
      isVisible: true,
      createdAt: true,
      attendee: {
        select: {
          displayName: true,
        },
      },
      order: {
        select: {
          buyerName: true,
        },
      },
    },
  },
};

async function getOwnEvent(id: string, organizerProfileId: string) {
  return prisma.event.findFirst({ where: { id, organizerProfileId }, select: eventSelect });
}

function eventRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Sign in required" });
    }
    if (error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
    }
  }

  console.error("[app/api/organizer/events/[id]/route.ts]", error);
  return fail(500, { code: "INTERNAL_ERROR", message: fallbackMessage });
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

    const ticketClasses = serializeTicketClasses(event.ticketTypes);

    return ok({
      ...event,
      ticketTypes: ticketClasses,
      ticketClasses,
      reviews: event.reviews.map((review) => ({
        ...review,
        attendeeName: getReviewAttendeeName(review),
      })),
      auditLogs,
    });
  } catch (error) {
    return eventRouteError(error, "Failed to load event");
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

    const { startAt, endAt, heroImage, videoUrl, contactEmail, images, seriesId, stateName, cityName, ...rest } = parsed.data;

    if (seriesId !== undefined && seriesId !== null) {
      const ownedSeries = await prisma.eventSeries.findFirst({
        where: { id: seriesId, organizerProfileId: profile.id },
        select: { id: true },
      });
      if (!ownedSeries) {
        return fail(404, { code: "SERIES_NOT_FOUND", message: "Series not found" });
      }
    }

    const resolvedLocation = await resolveLocationIds({
      countryId: rest.countryId,
      stateId: rest.stateId,
      stateName,
      cityId: rest.cityId,
      cityName,
    });

    const oldStartAt = existing.startAt;

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...rest,
        ...resolvedLocation,
        ...(heroImage !== undefined ? { heroImage: heroImage || null } : {}),
        ...(videoUrl !== undefined ? { videoUrl: videoUrl || null } : {}),
        ...(images !== undefined ? { images } : {}),
        ...(contactEmail !== undefined ? { contactEmail: contactEmail || null } : {}),
        ...(startAt ? { startAt: new Date(startAt) } : {}),
        ...(endAt ? { endAt: new Date(endAt) } : {}),
        ...(seriesId !== undefined ? { seriesId } : {}),
      },
      select: eventSelect,
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
    if (error instanceof Error && error.message === "CITY_REQUIRES_STATE") {
      return fail(400, { code: "CITY_REQUIRES_STATE", message: "Enter or select a state before the city" });
    }
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
