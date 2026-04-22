import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

const REFRESH_INTERVAL_MS = 10_000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const event = await prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      seatingPlan: {
        select: {
          sections: {
            select: {
              key: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    return fail(404, { code: "NOT_FOUND", message: "Event not found" });
  }

  if (!event.seatingPlan) {
    return ok({
      seatingEnabled: false,
      statuses: {},
      refreshIntervalMs: REFRESH_INTERVAL_MS,
    });
  }

  const now = new Date();
  await prisma.eventSeatBooking.deleteMany({
    where: {
      eventId: event.id,
      status: "RESERVED",
      expiresAt: { lt: now },
    },
  });

  const bookings = await prisma.eventSeatBooking.findMany({
    where: {
      eventId: event.id,
      OR: [
        { status: "BOOKED" },
        {
          status: "RESERVED",
          expiresAt: { gt: now },
        },
      ],
    },
    select: {
      seatId: true,
      seatLabel: true,
      status: true,
      expiresAt: true,
    },
  });

  const statuses = Object.fromEntries(
    bookings.map((booking) => [
      booking.seatId,
      {
        status: booking.status,
        seatLabel: booking.seatLabel,
        expiresAt: booking.expiresAt?.toISOString() ?? null,
      },
    ]),
  );

  const seatAvailability = Object.fromEntries(
    bookings.map((booking) => [booking.seatId, booking.status.toLowerCase()]),
  );

  return ok({
    seatingEnabled: true,
    statuses,
    seatAvailability,
    summary: {
      booked: bookings.filter((booking) => booking.status === "BOOKED").length,
      reserved: bookings.filter((booking) => booking.status === "RESERVED").length,
    },
    refreshIntervalMs: REFRESH_INTERVAL_MS,
    updatedAt: new Date().toISOString(),
  });
}
