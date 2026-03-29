import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

type NearbyEventRow = {
  id: string;
  distance_km: number;
};

function parseNumber(value: string | null, fallback?: number) {
  if (value === null || value.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function GET(req: NextRequest) {
  const rawLat = parseNumber(req.nextUrl.searchParams.get("lat"));
  const rawLng = parseNumber(req.nextUrl.searchParams.get("lng"));
  const rawRadiusKm = parseNumber(req.nextUrl.searchParams.get("radiusKm"), 50);
  const limit = Math.max(
    1,
    Math.min(50, Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "12", 10) || 12),
  );

  if (
    typeof rawLat !== "number" ||
    typeof rawLng !== "number" ||
    Number.isNaN(rawLat) ||
    Number.isNaN(rawLng) ||
    rawLat < -90 ||
    rawLat > 90 ||
    rawLng < -180 ||
    rawLng > 180
  ) {
    return fail(400, { code: "INVALID_COORDS", message: "Valid latitude and longitude are required" });
  }

  const lat = rawLat;
  const lng = rawLng;
  const normalizedRadiusKm =
    typeof rawRadiusKm === "number" && Number.isFinite(rawRadiusKm) && rawRadiusKm > 0
      ? rawRadiusKm
      : 50;

  const nearbyRows = await prisma.$queryRaw<NearbyEventRow[]>(Prisma.sql`
    SELECT nearby.id, nearby.distance_km
    FROM (
      SELECT
        e.id,
        (
          6371 * acos(
            cos(radians(${lat})) * cos(radians(v.lat)) *
            cos(radians(v.lng) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(v.lat))
          )
        ) AS distance_km
      FROM "Event" e
      JOIN "Venue" v ON e."venueId" = v.id
      WHERE e.status = 'PUBLISHED'
        AND e."startAt" > NOW()
        AND v.lat IS NOT NULL
        AND v.lng IS NOT NULL
    ) nearby
    WHERE nearby.distance_km <= ${normalizedRadiusKm}
    ORDER BY nearby.distance_km ASC
    LIMIT ${limit}
  `);

  if (nearbyRows.length === 0) {
    return ok({ events: [], radiusKm: normalizedRadiusKm });
  }

  const ids = nearbyRows.map((row) => row.id);
  const events = await prisma.event.findMany({
    where: { id: { in: ids } },
    include: {
      category: true,
      venue: true,
      city: true,
      ticketTypes: {
        where: { isActive: true },
        orderBy: { price: "asc" },
      },
    },
  });

  const byId = new Map(events.map((event) => [event.id, event]));
  const distanceById = new Map(nearbyRows.map((row) => [row.id, row.distance_km]));
  const orderedEvents = ids
    .map((id) => {
      const event = byId.get(id);
      if (!event) return null;

      return {
        ...event,
        distanceKm: distanceById.get(id) ?? null,
      };
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event));

  return ok({ events: orderedEvents, radiusKm: normalizedRadiusKm });
}
