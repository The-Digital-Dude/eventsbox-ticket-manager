import type { Prisma, PrismaClient } from "@prisma/client";

type SeatBookingClient =
  | Pick<PrismaClient, "eventSeatBooking" | "seatInventory">
  | Pick<Prisma.TransactionClient, "eventSeatBooking" | "seatInventory">;

export async function cleanupExpiredSeatReservations(
  client: SeatBookingClient,
  options: { eventId?: string; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const eventFilter = options.eventId ? { eventId: options.eventId } : {};

  const [legacyBookings, inventorySeats] = await Promise.all([
    client.eventSeatBooking.deleteMany({
      where: {
        ...eventFilter,
        status: "RESERVED",
        expiresAt: { lte: now },
      },
    }),
    client.seatInventory.updateMany({
      where: {
        ...eventFilter,
        status: "RESERVED",
        expiresAt: { lte: now },
      },
      data: {
        status: "AVAILABLE",
        orderId: null,
        expiresAt: null,
      },
    }),
  ]);

  return {
    legacyBookingsReleased: legacyBookings.count,
    inventorySeatsReleased: inventorySeats.count,
  };
}

export async function releaseSeatBookingsForOrder(client: SeatBookingClient, orderId: string) {
  await client.eventSeatBooking.deleteMany({
    where: { orderId },
  });
  if ("seatInventory" in client) {
    await client.seatInventory.updateMany({
      where: { orderId },
      data: {
        status: "AVAILABLE",
        orderId: null,
        expiresAt: null,
      },
    });
  }
}

export async function markSeatBookingsBooked(client: SeatBookingClient, orderId: string) {
  const inventorySeats = "seatInventory" in client
    ? await client.seatInventory.findMany({
        where: { orderId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          seatLabel: true,
        },
      })
    : [];

  if (inventorySeats.length > 0) {
    await client.seatInventory.updateMany({
      where: { orderId },
      data: {
        status: "SOLD",
        expiresAt: null,
      },
    });

    return inventorySeats.map((seat) => ({
      seatId: seat.id,
      seatLabel: seat.seatLabel,
    }));
  }

  const seatBookings = await client.eventSeatBooking.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: {
      seatId: true,
      seatLabel: true,
    },
  });

  await client.eventSeatBooking.updateMany({
    where: { orderId },
    data: {
      status: "BOOKED",
      expiresAt: null,
    },
  });

  return seatBookings;
}
