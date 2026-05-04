import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  eventFindFirstMock,
  eventSeatBookingDeleteManyMock,
  seatInventoryUpdateManyMock,
  prismaTransactionMock,
  txEventSeatBookingDeleteManyMock,
  txEventFindFirstMock,
  txSeatInventoryFindManyMock,
  txSeatInventoryUpdateManyMock,
} = vi.hoisted(() => ({
  eventFindFirstMock: vi.fn(),
  eventSeatBookingDeleteManyMock: vi.fn(),
  seatInventoryUpdateManyMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
  txEventSeatBookingDeleteManyMock: vi.fn(),
  txEventFindFirstMock: vi.fn(),
  txSeatInventoryFindManyMock: vi.fn(),
  txSeatInventoryUpdateManyMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      findFirst: eventFindFirstMock,
    },
    eventSeatBooking: {
      deleteMany: eventSeatBookingDeleteManyMock,
    },
    seatInventory: {
      updateMany: seatInventoryUpdateManyMock,
    },
    $transaction: prismaTransactionMock,
  },
}));

import { GET as getPublicSeats } from "@/app/api/public/events/[slug]/seats/route";
import { POST as reservePublicSeats } from "@/app/api/public/events/[slug]/reserve/route";

const futureDate = new Date("2026-05-04T12:10:00.000Z");
const pastDate = new Date("2026-05-04T11:50:00.000Z");

describe("public seat reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seatInventoryUpdateManyMock.mockResolvedValue({ count: 0 });
    eventSeatBookingDeleteManyMock.mockResolvedValue({ count: 0 });
    txEventSeatBookingDeleteManyMock.mockResolvedValue({ count: 0 });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns SeatInventory seats and treats expired reservations as available", async () => {
    eventFindFirstMock.mockResolvedValue({
      id: "event-1",
      mode: "RESERVED_SEATING",
      ticketTypes: [{ id: "ticket-1", sectionId: "section-1", name: "Main", price: "50.00" }],
      seatingSections: [
        {
          id: "section-1",
          name: "Main",
          color: "#2563eb",
          sortOrder: 0,
          rows: [
            {
              id: "row-1",
              label: "A",
              sortOrder: 0,
              seats: [
                {
                  id: "seat-1",
                  sectionId: "section-1",
                  rowId: "row-1",
                  seatLabel: "A1",
                  status: "RESERVED",
                  expiresAt: pastDate,
                },
                {
                  id: "seat-2",
                  sectionId: "section-1",
                  rowId: "row-1",
                  seatLabel: "A2",
                  status: "RESERVED",
                  expiresAt: futureDate,
                },
              ],
            },
          ],
        },
      ],
    });

    const response = await getPublicSeats(
      new NextRequest("http://localhost/api/public/events/seat-test/seats"),
      { params: Promise.resolve({ slug: "seat-test" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(seatInventoryUpdateManyMock).toHaveBeenCalledWith({
      where: {
        eventId: "event-1",
        status: "RESERVED",
        expiresAt: { lte: new Date("2026-05-04T12:00:00.000Z") },
      },
      data: {
        status: "AVAILABLE",
        orderId: null,
        expiresAt: null,
      },
    });
    expect(eventSeatBookingDeleteManyMock).toHaveBeenCalledWith({
      where: {
        eventId: "event-1",
        status: "RESERVED",
        expiresAt: { lte: new Date("2026-05-04T12:00:00.000Z") },
      },
    });
    expect(payload.data.seats[0]).toMatchObject({
      id: "seat-1",
      seatLabel: "A1",
      status: "AVAILABLE",
      price: 50,
      ticketTypeId: "ticket-1",
    });
    expect(payload.data.seats[1]).toMatchObject({
      id: "seat-2",
      status: "RESERVED",
    });
  });

  it("marks seats without a section-linked ticket unavailable instead of using a fallback price", async () => {
    eventFindFirstMock.mockResolvedValue({
      id: "event-1",
      mode: "RESERVED_SEATING",
      ticketTypes: [{ id: "ticket-ga", sectionId: null, name: "GA", price: "20.00" }],
      seatingSections: [
        {
          id: "section-1",
          name: "Main",
          color: "#2563eb",
          sortOrder: 0,
          rows: [
            {
              id: "row-1",
              label: "A",
              sortOrder: 0,
              seats: [
                {
                  id: "seat-1",
                  sectionId: "section-1",
                  rowId: "row-1",
                  seatLabel: "A1",
                  status: "AVAILABLE",
                  expiresAt: null,
                },
              ],
            },
          ],
        },
      ],
    });

    const response = await getPublicSeats(
      new NextRequest("http://localhost/api/public/events/seat-test/seats"),
      { params: Promise.resolve({ slug: "seat-test" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.seats[0]).toMatchObject({
      id: "seat-1",
      status: "BLOCKED",
      price: 0,
      ticketTypeId: null,
    });
  });

  it("reserves available seats for ten minutes and returns a token", async () => {
    prismaTransactionMock.mockImplementationOnce(async (callback) =>
      callback({
        event: { findFirst: txEventFindFirstMock },
        eventSeatBooking: { deleteMany: txEventSeatBookingDeleteManyMock },
        seatInventory: {
          findMany: txSeatInventoryFindManyMock,
          updateMany: txSeatInventoryUpdateManyMock,
        },
      }),
    );
    txEventFindFirstMock.mockResolvedValue({ id: "event-1", mode: "RESERVED_SEATING" });
    txSeatInventoryUpdateManyMock
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 2 });
    txSeatInventoryFindManyMock.mockResolvedValue([
      {
        id: "seat-1",
        eventId: "event-1",
        sectionId: "section-1",
        rowId: "row-1",
        seatLabel: "A1",
        status: "AVAILABLE",
        expiresAt: null,
      },
      {
        id: "seat-2",
        eventId: "event-1",
        sectionId: "section-1",
        rowId: "row-1",
        seatLabel: "A2",
        status: "AVAILABLE",
        expiresAt: null,
      },
    ]);

    const response = await reservePublicSeats(
      new NextRequest("http://localhost/api/public/events/seat-test/reserve", {
        method: "POST",
        body: JSON.stringify({ seatIds: ["seat-1", "seat-2"] }),
      }),
      { params: Promise.resolve({ slug: "seat-test" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.expiresAt).toBe("2026-05-04T12:10:00.000Z");
    expect(payload.data.reservationToken).toEqual(expect.any(String));
    expect(txSeatInventoryUpdateManyMock).toHaveBeenLastCalledWith({
      where: {
        eventId: "event-1",
        id: { in: ["seat-1", "seat-2"] },
        status: "AVAILABLE",
      },
      data: {
        status: "RESERVED",
        expiresAt: futureDate,
        orderId: null,
      },
    });
  });
});
