import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  eventFindFirstMock,
  eventSeatBookingDeleteManyMock,
  eventSeatBookingFindManyMock,
} = vi.hoisted(() => ({
  eventFindFirstMock: vi.fn(),
  eventSeatBookingDeleteManyMock: vi.fn(),
  eventSeatBookingFindManyMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      findFirst: eventFindFirstMock,
    },
    eventSeatBooking: {
      deleteMany: eventSeatBookingDeleteManyMock,
      findMany: eventSeatBookingFindManyMock,
    },
  },
}));

import { GET as getPublicEvent } from "@/app/api/public/events/[slug]/route";
import { GET as getPublicEventSeats } from "@/app/api/public/events/[slug]/seats/route";

const seatingPlan = {
  id: "plan-1",
  mode: "ROWS",
  sections: [
    {
      id: "main",
      key: "main",
      name: "Main",
      sectionType: "ROWS",
      capacity: 3,
      sortOrder: 0,
    },
  ],
};

describe("public event seating integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventSeatBookingDeleteManyMock.mockResolvedValue({ count: 0 });
    eventSeatBookingFindManyMock.mockResolvedValue([]);
  });

  it("includes venue seating config in the public event payload", async () => {
    eventFindFirstMock.mockResolvedValue({
      id: "event-1",
      title: "Seat Test",
      venue: {
        id: "venue-1",
        name: "Grand Hall",
        addressLine1: "1 Test Street",
      },
      seatingPlan,
      category: null,
      state: null,
      city: null,
      addOns: [],
      ticketTypes: [],
      organizerProfile: null,
      reviews: [],
      images: [],
      avgRating: 0,
      reviewCount: 0,
    });

    const response = await getPublicEvent(
      new NextRequest("http://localhost/api/public/events/seat-test"),
      { params: Promise.resolve({ slug: "seat-test" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.seatingPlan).toEqual(seatingPlan);
  });

  it("returns live booked and reserved seat availability", async () => {
    eventFindFirstMock.mockResolvedValue({
      id: "event-1",
      seatingPlan,
    });
    eventSeatBookingFindManyMock.mockResolvedValue([
      { seatId: "Main-A1", seatLabel: "Main A1", status: "BOOKED", expiresAt: null },
      { seatId: "Main-A2", seatLabel: "Main A2", status: "RESERVED", expiresAt: new Date("2026-03-10T00:10:00.000Z") },
    ]);

    const response = await getPublicEventSeats(
      new NextRequest("http://localhost/api/public/events/seat-test/seats"),
      { params: Promise.resolve({ slug: "seat-test" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.seatingEnabled).toBe(true);
    expect(payload.data.statuses["Main-A1"]).toEqual({
      status: "BOOKED",
      seatLabel: "Main A1",
      expiresAt: null,
    });
    expect(payload.data.seatAvailability).toEqual({
      "Main-A1": "booked",
      "Main-A2": "reserved",
    });
    expect(payload.data.summary).toEqual({
      booked: 1,
      reserved: 1,
    });
  });
});
