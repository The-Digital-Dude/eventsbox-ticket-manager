import { EventMode, SeatInventoryStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

const REFRESH_INTERVAL_MS = 10_000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const now = new Date();

  const event = await prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      mode: true,
      ticketTypes: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, sectionId: true, name: true, price: true },
      },
      seatingSections: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          color: true,
          sortOrder: true,
          rows: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              label: true,
              sortOrder: true,
              seats: {
                orderBy: [{ seatLabel: "asc" }],
                select: {
                  id: true,
                  sectionId: true,
                  rowId: true,
                  seatLabel: true,
                  status: true,
                  expiresAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!event) {
    return fail(404, { code: "NOT_FOUND", message: "Event not found" });
  }

  if (event.mode !== EventMode.RESERVED_SEATING) {
    return ok({
      seatingEnabled: false,
      sections: [],
      seats: [],
      refreshIntervalMs: REFRESH_INTERVAL_MS,
      updatedAt: now.toISOString(),
    });
  }

  await prisma.seatInventory.updateMany({
    where: {
      eventId: event.id,
      status: SeatInventoryStatus.RESERVED,
      expiresAt: { lte: now },
    },
    data: {
      status: SeatInventoryStatus.AVAILABLE,
      orderId: null,
      expiresAt: null,
    },
  });

  const ticketBySectionId = new Map(
    event.ticketTypes
      .filter((ticket) => ticket.sectionId)
      .map((ticket) => [ticket.sectionId!, ticket]),
  );

  const sections = event.seatingSections.map((section) => ({
    id: section.id,
    name: section.name,
    color: section.color,
    sortOrder: section.sortOrder,
    rows: section.rows.map((row) => ({
      id: row.id,
      label: row.label,
      sortOrder: row.sortOrder,
      seats: row.seats.map((seat) => {
        const expiredReservation =
          seat.status === SeatInventoryStatus.RESERVED &&
          seat.expiresAt !== null &&
          seat.expiresAt <= now;
        const ticket = ticketBySectionId.get(seat.sectionId) ?? null;
        const status = !ticket
          ? SeatInventoryStatus.BLOCKED
          : expiredReservation ? SeatInventoryStatus.AVAILABLE : seat.status;

        return {
          id: seat.id,
          sectionId: seat.sectionId,
          rowId: seat.rowId,
          seatLabel: seat.seatLabel,
          status,
          expiresAt: status === SeatInventoryStatus.AVAILABLE || status === SeatInventoryStatus.BLOCKED ? null : seat.expiresAt,
          ticketTypeId: ticket?.id ?? null,
          ticketTypeName: ticket?.name ?? null,
          price: ticket ? Number(ticket.price) : 0,
        };
      }),
    })),
  }));

  const seats = sections.flatMap((section) => section.rows.flatMap((row) => row.seats));

  return ok({
    seatingEnabled: true,
    sections,
    seats,
    summary: {
      available: seats.filter((seat) => seat.status === SeatInventoryStatus.AVAILABLE).length,
      reserved: seats.filter((seat) => seat.status === SeatInventoryStatus.RESERVED).length,
      sold: seats.filter((seat) => seat.status === SeatInventoryStatus.SOLD).length,
      blocked: seats.filter((seat) => seat.status === SeatInventoryStatus.BLOCKED).length,
    },
    refreshIntervalMs: REFRESH_INTERVAL_MS,
    updatedAt: now.toISOString(),
  });
}
