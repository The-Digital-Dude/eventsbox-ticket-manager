import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { eventCreateSchema } from "@/src/lib/validators/event";
import { slugify } from "@/src/lib/utils/slug";
import { copyVenueSeatingToEvent } from "@/src/lib/services/venue-seating-copy";
import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";
import type { Prisma } from "@prisma/client";

function locationCode(value: string) {
  const base = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "LOCATION";
}

async function ensureStateAndCity(
  tx: Prisma.TransactionClient,
  input: {
    countryId?: string;
    stateId?: string;
    cityId?: string;
    stateName?: string;
    cityName?: string;
  },
) {
  const stateName = input.stateName?.trim();
  const cityName = input.cityName?.trim();

  const state = input.stateId
    ? await tx.state.findUnique({ where: { id: input.stateId }, select: { id: true, countryId: true } })
    : stateName
      ? await tx.state.upsert({
          where: { name: stateName },
          update: input.countryId ? { countryId: input.countryId } : {},
          create: {
            name: stateName,
            code: `${locationCode(stateName)}_${Date.now().toString(36)}`,
            countryId: input.countryId,
          },
          select: { id: true, countryId: true },
        })
      : null;

  if (!state) throw new Error("LOCATION_REQUIRED");

  const city = input.cityId
    ? await tx.city.findFirst({ where: { id: input.cityId, stateId: state.id }, select: { id: true } })
    : cityName
      ? await tx.city.upsert({
          where: { stateId_name: { stateId: state.id, name: cityName } },
          update: {},
          create: { stateId: state.id, name: cityName },
          select: { id: true },
        })
      : null;

  if (!city) throw new Error("LOCATION_REQUIRED");

  return {
    countryId: input.countryId ?? state.countryId ?? undefined,
    stateId: state.id,
    cityId: city.id,
  };
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

    const parsed = eventCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid event data", details: parsed.error.flatten() });
    }

    const { startAt, endAt, heroImage, videoUrl, contactEmail, onlineAccessLink, locationMode, oneTimeVenue, ...rest } = parsed.data;

    if (new Date(endAt) <= new Date(startAt)) {
      return fail(400, { code: "INVALID_DATES", message: "End date must be after start date" });
    }

    const event = await prisma.$transaction(async (tx) => {
      let venueId = rest.eventType === "PHYSICAL" && locationMode === "SAVED_VENUE" ? rest.venueId : undefined;
      let templateVenue: {
        id: string;
        countryId: string | null;
        stateId: string;
        cityId: string;
        lat: number | null;
        lng: number | null;
        seatingConfig: unknown;
        seatState: unknown;
      } | null = null;

      if (rest.eventType === "PHYSICAL" && locationMode === "SAVED_VENUE") {
        const venue = await tx.venue.findFirst({
          where: {
            id: venueId,
            organizerProfileId: profile.id,
            status: "APPROVED",
            isEventOnly: false,
          },
          select: { id: true, countryId: true, stateId: true, cityId: true, lat: true, lng: true, seatingConfig: true, seatState: true },
        });
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        templateVenue = venue;
      }

      if (rest.eventType === "PHYSICAL" && locationMode !== "SAVED_VENUE" && oneTimeVenue) {
        const location = await ensureStateAndCity(tx, oneTimeVenue);
        const venue = await tx.venue.create({
          data: {
            organizerProfileId: profile.id,
            isEventOnly: true,
            status: "APPROVED",
            name: oneTimeVenue.name,
            addressLine1: oneTimeVenue.addressLine1,
            addressLine2: oneTimeVenue.addressLine2,
            countryId: location.countryId,
            stateId: location.stateId,
            cityId: location.cityId,
            categoryId: oneTimeVenue.categoryId,
            lat: oneTimeVenue.lat,
            lng: oneTimeVenue.lng,
          },
          select: { id: true },
        });
        venueId = venue.id;
        oneTimeVenue.stateId = location.stateId;
        oneTimeVenue.cityId = location.cityId;
        oneTimeVenue.countryId = location.countryId;
      }

      const created = await tx.event.create({
        data: {
          ...rest,
          venueId: rest.eventType === "PHYSICAL" ? venueId : null,
          countryId: rest.eventType === "PHYSICAL" ? (oneTimeVenue?.countryId ?? templateVenue?.countryId ?? rest.countryId) : null,
          stateId: rest.eventType === "PHYSICAL" ? (oneTimeVenue?.stateId ?? templateVenue?.stateId ?? rest.stateId) : null,
          cityId: rest.eventType === "PHYSICAL" ? (oneTimeVenue?.cityId ?? templateVenue?.cityId ?? rest.cityId) : null,
          lat: rest.eventType === "PHYSICAL" ? (oneTimeVenue?.lat ?? templateVenue?.lat ?? rest.lat) : null,
          lng: rest.eventType === "PHYSICAL" ? (oneTimeVenue?.lng ?? templateVenue?.lng ?? rest.lng) : null,
          heroImage: heroImage || null,
          videoUrl: videoUrl || null,
          contactEmail: contactEmail || null,
          onlineAccessLink: rest.eventType === "ONLINE" ? onlineAccessLink || null : null,
          organizerProfileId: profile.id,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          slug: slugify(parsed.data.title),
        },
        include: {
          category: { select: { id: true, name: true } },
          venue: { select: { id: true, name: true } },
        },
      });

      if (created.mode === "RESERVED_SEATING" && templateVenue?.seatingConfig) {
        await copyVenueSeatingToEvent(tx, {
          eventId: created.id,
          seatingConfig: templateVenue.seatingConfig as VenueSeatingConfig,
          seatState: templateVenue.seatState as Record<string, SeatState> | null,
        });
      }

      return created;
    });

    return ok(event, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "VENUE_NOT_FOUND") {
      return fail(404, { code: "VENUE_NOT_FOUND", message: "Saved venue not found" });
    }
    if (error instanceof Error && error.message === "LOCATION_REQUIRED") {
      return fail(400, { code: "LOCATION_REQUIRED", message: "State and city are required" });
    }
    console.error("[app/api/organizer/events/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to create event" });
  }
}
