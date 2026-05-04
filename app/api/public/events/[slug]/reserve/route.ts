import { EventMode, SeatInventoryStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { createReservationToken } from "@/src/lib/reservations";
import { cleanupExpiredSeatReservations } from "@/src/lib/services/seat-booking";
import { publicSeatReservationSchema } from "@/src/lib/validators/event";

const HOLD_MINUTES = 10;

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const parsed = publicSeatReservationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid reservation data",
        details: parsed.error.flatten(),
      });
    }

    const { slug } = await params;
    const seatIds = Array.from(new Set(parsed.data.seatIds));
    if (seatIds.length !== parsed.data.seatIds.length) {
      return fail(400, {
        code: "DUPLICATE_SEAT_SELECTION",
        message: "Each selected seat must be unique",
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

    const reservation = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { slug, status: "PUBLISHED" },
        select: { id: true, mode: true },
      });
      if (!event) throw new Error("EVENT_NOT_FOUND");
      if (event.mode !== EventMode.RESERVED_SEATING) throw new Error("INVALID_EVENT_MODE");

      await cleanupExpiredSeatReservations(tx, { eventId: event.id, now });

      const seats = await tx.seatInventory.findMany({
        where: { id: { in: seatIds } },
        select: {
          id: true,
          eventId: true,
          sectionId: true,
          rowId: true,
          seatLabel: true,
          status: true,
          expiresAt: true,
        },
      });

      if (seats.length !== seatIds.length) throw new Error("INVALID_SEATS");
      if (seats.some((seat) => seat.eventId !== event.id)) throw new Error("INVALID_SEATS");

      const unavailable = seats.find((seat) => seat.status !== SeatInventoryStatus.AVAILABLE);
      if (unavailable) throw new Error(`SEAT_UNAVAILABLE:${unavailable.seatLabel}`);

      const updated = await tx.seatInventory.updateMany({
        where: {
          eventId: event.id,
          id: { in: seatIds },
          status: SeatInventoryStatus.AVAILABLE,
        },
        data: {
          status: SeatInventoryStatus.RESERVED,
          expiresAt,
          orderId: null,
        },
      });
      if (updated.count !== seatIds.length) throw new Error("SEATS_CHANGED");

      return {
        eventId: event.id,
        seats,
      };
    }, { maxWait: 15000, timeout: 15000 });

    return ok({
      reservationToken: createReservationToken({
        eventId: reservation.eventId,
        seatIds,
        expiresAt: expiresAt.toISOString(),
      }),
      expiresAt: expiresAt.toISOString(),
      seats: reservation.seats.map((seat) => ({
        id: seat.id,
        sectionId: seat.sectionId,
        rowId: seat.rowId,
        seatLabel: seat.seatLabel,
        status: SeatInventoryStatus.RESERVED,
        expiresAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "EVENT_NOT_FOUND") {
        return fail(404, { code: "NOT_FOUND", message: "Event not found" });
      }
      if (error.message === "INVALID_EVENT_MODE") {
        return fail(400, { code: "INVALID_EVENT_MODE", message: "Reservations are only available for reserved seating events" });
      }
      if (error.message === "INVALID_SEATS") {
        return fail(400, { code: "INVALID_SEATS", message: "One or more seats are not part of this event" });
      }
      if (error.message === "SEATS_CHANGED") {
        return fail(409, { code: "SEATS_CHANGED", message: "One or more seats were just taken. Please choose again." });
      }
      if (error.message.startsWith("SEAT_UNAVAILABLE:")) {
        return fail(409, {
          code: "SEAT_UNAVAILABLE",
          message: `${error.message.split(":")[1]} is no longer available`,
        });
      }
    }

    console.error("[app/api/public/events/[slug]/reserve/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to reserve seats" });
  }
}
