import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireRoleMock,
  profileFindUniqueMock,
  venueFindManyMock,
  txVenueCreateMock,
  txVenueFindFirstMock,
  txStateFindUniqueMock,
  txStateUpsertMock,
  txCityFindFirstMock,
  txCityUpsertMock,
  txEventCreateMock,
  txSeatingSectionCreateMock,
  txSeatingRowCreateMock,
  txSeatInventoryCreateManyMock,
  txTableZoneCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  profileFindUniqueMock: vi.fn(),
  venueFindManyMock: vi.fn(),
  txVenueCreateMock: vi.fn(),
  txVenueFindFirstMock: vi.fn(),
  txStateFindUniqueMock: vi.fn(),
  txStateUpsertMock: vi.fn(),
  txCityFindFirstMock: vi.fn(),
  txCityUpsertMock: vi.fn(),
  txEventCreateMock: vi.fn(),
  txSeatingSectionCreateMock: vi.fn(),
  txSeatingRowCreateMock: vi.fn(),
  txSeatInventoryCreateManyMock: vi.fn(),
  txTableZoneCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: {
      findUnique: profileFindUniqueMock,
    },
    venue: {
      findMany: venueFindManyMock,
    },
    $transaction: transactionMock,
  },
}));

import { POST as eventCreatePost } from "@/app/api/organizer/events/route";
import { GET as venueListGet } from "@/app/api/organizer/venues/route";

const savedVenueSeating = {
  mapType: "seats",
  sections: [
    {
      id: "main",
      name: "Main",
      mapType: "seats",
      rowStart: 0,
      maxRows: 2,
      columns: [{ index: 1, rows: 2, seats: 3 }],
    },
  ],
  summary: { totalSeats: 6, totalTables: 0, sectionCount: 1 },
  schemaVersion: 1,
};

function tx() {
  let rowIndex = 0;
  return {
    venue: {
      create: txVenueCreateMock,
      findFirst: txVenueFindFirstMock,
    },
    state: {
      findUnique: txStateFindUniqueMock,
      upsert: txStateUpsertMock,
    },
    city: {
      findFirst: txCityFindFirstMock,
      upsert: txCityUpsertMock,
    },
    event: {
      create: txEventCreateMock,
    },
    seatingSection: {
      create: txSeatingSectionCreateMock,
    },
    seatingRow: {
      create: txSeatingRowCreateMock.mockImplementation(async () => ({ id: `row-${rowIndex += 1}` })),
    },
    seatInventory: {
      createMany: txSeatInventoryCreateManyMock,
    },
    tableZone: {
      create: txTableZoneCreateMock,
    },
  };
}

function eventBody(overrides: Record<string, unknown>) {
  return {
    mode: "SIMPLE",
    title: "Temporary Venue Event",
    eventType: "PHYSICAL",
    visibility: "PUBLIC",
    startAt: "2026-08-01T10:00:00.000Z",
    endAt: "2026-08-01T12:00:00.000Z",
    timezone: "UTC",
    ...overrides,
  };
}

describe("event one-time venue creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue({ sub: "organizer-user-1", role: "ORGANIZER" });
    profileFindUniqueMock.mockResolvedValue({ id: "organizer-profile-1", approvalStatus: "APPROVED" });
    venueFindManyMock.mockResolvedValue([]);
    txVenueCreateMock.mockResolvedValue({ id: "hidden-venue-1" });
    txVenueFindFirstMock.mockResolvedValue(null);
    txStateFindUniqueMock.mockResolvedValue({ id: "state-1", countryId: "country-1" });
    txStateUpsertMock.mockResolvedValue({ id: "state-1", countryId: "country-1" });
    txCityFindFirstMock.mockResolvedValue({ id: "city-1" });
    txCityUpsertMock.mockResolvedValue({ id: "city-1" });
    txEventCreateMock.mockResolvedValue({
      id: "event-1",
      title: "Temporary Venue Event",
      mode: "SIMPLE",
      venue: { id: "hidden-venue-1", name: "Temporary Hall" },
    });
    txSeatingSectionCreateMock.mockResolvedValue({ id: "section-1" });
    txSeatInventoryCreateManyMock.mockResolvedValue({ count: 5 });
    transactionMock.mockImplementation(async (callback) => callback(tx()));
  });

  it("creates a hidden approved venue for one-time physical event locations", async () => {
    const response = await eventCreatePost(new NextRequest("http://localhost/api/organizer/events", {
      method: "POST",
      body: JSON.stringify(eventBody({
        locationMode: "ONE_TIME",
        oneTimeVenue: {
          name: "Temporary Hall",
          addressLine1: "123 Temporary Road",
          stateName: "Test State",
          cityName: "Test City",
          countryId: "country-1",
          lat: 1,
          lng: 2,
        },
      })),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(201);
    expect(txVenueCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizerProfileId: "organizer-profile-1",
        isEventOnly: true,
        status: "APPROVED",
        name: "Temporary Hall",
        addressLine1: "123 Temporary Road",
        stateId: "state-1",
        cityId: "city-1",
      }),
      select: { id: true },
    });
    expect(txEventCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        venueId: "hidden-venue-1",
        stateId: "state-1",
        cityId: "city-1",
        lat: 1,
        lng: 2,
      }),
    }));
  });

  it("hides event-only venues from the organizer venue list", async () => {
    const response = await venueListGet(new NextRequest("http://localhost/api/organizer/venues"));

    expect(response.status).toBe(200);
    expect(venueFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizerProfileId: "organizer-profile-1", isEventOnly: false },
    }));
  });

  it("copies saved venue seating into reserved-seating events as event-owned inventory", async () => {
    txVenueFindFirstMock.mockResolvedValue({
      id: "venue-1",
      countryId: "country-1",
      stateId: "state-1",
      cityId: "city-1",
      lat: 1,
      lng: 2,
      seatingConfig: savedVenueSeating,
      seatState: { "Main-A2": { deleted: true } },
    });
    txEventCreateMock.mockResolvedValue({
      id: "event-1",
      title: "Reserved Venue Event",
      mode: "RESERVED_SEATING",
      venue: { id: "venue-1", name: "Template Hall" },
    });

    const response = await eventCreatePost(new NextRequest("http://localhost/api/organizer/events", {
      method: "POST",
      body: JSON.stringify(eventBody({
        mode: "RESERVED_SEATING",
        title: "Reserved Venue Event",
        locationMode: "SAVED_VENUE",
        venueId: "venue-1",
      })),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(201);
    expect(txVenueFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "venue-1",
        organizerProfileId: "organizer-profile-1",
        status: "APPROVED",
        isEventOnly: false,
      }),
    }));
    expect(txSeatingSectionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: "event-1", name: "Main" }),
    });
    expect(txSeatInventoryCreateManyMock).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ seatLabel: "A-1" }),
        expect.objectContaining({ seatLabel: "B-3" }),
      ]),
      skipDuplicates: true,
    });
    const createManyCall = txSeatInventoryCreateManyMock.mock.calls[0]?.[0] as { data: unknown[] } | undefined;
    expect(createManyCall?.data).toHaveLength(5);
  });
});
