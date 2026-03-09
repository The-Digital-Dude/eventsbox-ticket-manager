import type { Prisma, PrismaClient } from "@prisma/client";

type SeatBookingClient = Pick<PrismaClient, "eventSeatBooking"> | Pick<Prisma.TransactionClient, "eventSeatBooking">;

export async function releaseSeatBookingsForOrder(client: SeatBookingClient, orderId: string) {
  await client.eventSeatBooking.deleteMany({
    where: { orderId },
  });
}

export async function markSeatBookingsBooked(client: SeatBookingClient, orderId: string) {
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
