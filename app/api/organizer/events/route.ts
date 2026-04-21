import { NextRequest } from "next/server";
import { EventSeatingMode, Role, TicketClassType } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { resolveLocationIds } from "@/src/lib/location-resolution";
import { sharedEventSchema } from "@/src/lib/validators/shared-event-schema";
import { slugify } from "@/src/lib/utils/slug";

function optionalId(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function deriveSeatingMode(ticketClasses: Array<{ classType: TicketClassType }>) {
  const classTypes = new Set(ticketClasses.map((ticketClass) => ticketClass.classType));
  const hasAssignedSeats = classTypes.has(TicketClassType.ASSIGNED_SEAT);
  const hasTables = classTypes.has(TicketClassType.TABLE);
  const hasSectionedGa = classTypes.has(TicketClassType.SECTIONED_GA);

  if (hasSectionedGa || (hasAssignedSeats && hasTables)) {
    return EventSeatingMode.MIXED;
  }
  if (hasTables) {
    return EventSeatingMode.TABLES;
  }
  if (hasAssignedSeats) {
    return EventSeatingMode.ROWS;
  }
  return EventSeatingMode.GA_ONLY;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile not found" });

    const rawStatus = req.nextUrl.searchParams.get("status");
    const events = await prisma.event.findMany({
      where: {
        organizerProfileId: profile.id,
        ...(rawStatus ? { status: rawStatus as never } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
        _count: { select: { ticketTypes: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(events);
  } catch (error) {
    console.error("[app/api/organizer/events/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile not found" });
    if (profile.approvalStatus !== "APPROVED") {
      return fail(403, { code: "NOT_APPROVED", message: "Your account must be approved before creating events" });
    }

    const parsed = sharedEventSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid event data", details: parsed.error.flatten() });
    }

    const {
      startAt,
      endAt,
      heroImage,
      videoUrl,
      contactEmail,
      stateName,
      cityName,
      ticketClasses,
      layout,
      categoryId,
      venueId,
      countryId,
      stateId,
      cityId,
      ...rest
    } = parsed.data;

    if (new Date(endAt) <= new Date(startAt)) {
      return fail(400, { code: "INVALID_DATES", message: "End date must be after start date" });
    }

    const resolvedLocation = await resolveLocationIds({
      countryId: optionalId(countryId),
      stateId: optionalId(stateId),
      stateName,
      cityId: optionalId(cityId),
      cityName,
    });
    const seatingMode = deriveSeatingMode(ticketClasses);

    const event = await prisma.event.create({
      data: {
        ...rest,
        categoryId: optionalId(categoryId),
        venueId: optionalId(venueId),
        countryId: optionalId(countryId),
        ...resolvedLocation,
        heroImage: heroImage || null,
        videoUrl: videoUrl || null,
        contactEmail: contactEmail || null,
        organizerProfileId: profile.id,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        seatingMode,
        slug: slugify(parsed.data.title),
        ticketTypes: {
          create: ticketClasses.map((tc) => ({
            name: tc.name,
            price: tc.price,
            quantity: tc.quantity,
            classType: tc.classType,
          })),
        },
        seatingPlan: layout ? {
          create: {
            mode: seatingMode,
            seatingConfig: layout.seatingConfig,
            seatState: layout.seatState,
            summary: layout.summary,
          },
        } : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
      },
    });

    return ok(event, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "CITY_REQUIRES_STATE") {
      return fail(400, { code: "CITY_REQUIRES_STATE", message: "Enter or select a state before the city" });
    }
    console.error("[app/api/organizer/events/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to create event" });
  }
}
