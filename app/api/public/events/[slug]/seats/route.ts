import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { resolveEventSeating } from "@/src/lib/event-seating";
import { fail, ok } from "@/src/lib/http/response";
import { buildPublicSeatStatusMap, getSeatDescriptorMap, sanitizePublicSeatState } from "@/src/lib/venue-seating";

const REFRESH_INTERVAL_MS = 10_000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const event = await prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      seatingPlan: {
        select: {
          seatingConfig: true,
          seatState: true,
          sections: {
            select: {
              key: true,
              name: true,
            },
          },
        },
      },
      venue: {
        select: {
          seatingConfig: true,
          seatState: true,
        },
      },
    },
  });

  if (!event) {
    return fail(404, { code: "NOT_FOUND", message: "Event not found" });
  }

  const resolvedSeating = resolveEventSeating(event);
  const seatingConfig = resolvedSeating.seatingConfig;
  const seatState = sanitizePublicSeatState(resolvedSeating.seatState);

  if (!seatingConfig) {
    return ok({
      seatingEnabled: false,
      statuses: {},
      refreshIntervalMs: REFRESH_INTERVAL_MS,
    });
  }

  const bookings = await prisma.eventSeatBooking.findMany({
    where: {
      eventId: event.id,
      OR: [
        { status: "BOOKED" },
        { status: "RESERVED", expiresAt: { gte: new Date() } },
      ],
    },
    select: {
      seatId: true,
      seatLabel: true,
      status: true,
      expiresAt: true,
    },
  });

  const seatDescriptorMap = getSeatDescriptorMap(seatingConfig, seatState);
  const statuses = buildPublicSeatStatusMap(
    Object.keys(seatDescriptorMap),
    bookings.map((booking) => ({
      ...booking,
      seatLabel: booking.seatLabel ?? seatDescriptorMap[booking.seatId]?.seatLabel ?? booking.seatId,
    })),
  );

  const seatAvailability = Object.fromEntries(
    Object.entries(statuses)
      .filter(([, value]) => value.status !== "AVAILABLE")
      .map(([seatId, value]) => [seatId, value.status === "BOOKED" ? "booked" : "reserved"]),
  );
  const summary = {
    booked: Object.values(statuses).filter((value) => value.status === "BOOKED").length,
    reserved: Object.values(statuses).filter((value) => value.status === "RESERVED").length,
  };

  return ok({
    seatingEnabled: true,
    statuses,
    seatAvailability,
    summary,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
    updatedAt: new Date().toISOString(),
  });
}
