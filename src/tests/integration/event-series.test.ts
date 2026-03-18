import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireRoleMock,
  organizerProfileFindUniqueMock,
  eventSeriesFindManyMock,
  eventSeriesCreateMock,
  eventSeriesFindFirstMock,
  eventSeriesFindUniqueMock,
  eventFindFirstMock,
  eventUpdateMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  organizerProfileFindUniqueMock: vi.fn(),
  eventSeriesFindManyMock: vi.fn(),
  eventSeriesCreateMock: vi.fn(),
  eventSeriesFindFirstMock: vi.fn(),
  eventSeriesFindUniqueMock: vi.fn(),
  eventFindFirstMock: vi.fn(),
  eventUpdateMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: {
      findUnique: organizerProfileFindUniqueMock,
    },
    eventSeries: {
      findMany: eventSeriesFindManyMock,
      create: eventSeriesCreateMock,
      findFirst: eventSeriesFindFirstMock,
      findUnique: eventSeriesFindUniqueMock,
    },
    event: {
      findFirst: eventFindFirstMock,
      update: eventUpdateMock,
    },
  },
}));

import { POST as createSeriesPost } from "@/app/api/organizer/series/route";
import { PATCH as patchEventPost } from "@/app/api/organizer/events/[id]/route";
import { GET as publicSeriesGet } from "@/app/api/public/series/[id]/route";

describe("event series integration", () => {
  const seriesId = "ckseries000000000000000001";

  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "organizer-user-1", role: "ORGANIZER" });
    organizerProfileFindUniqueMock.mockResolvedValue({ id: "org-profile-1" });
    eventSeriesFindManyMock.mockResolvedValue([]);
    eventSeriesCreateMock.mockResolvedValue({
      id: seriesId,
      title: "Spring Sessions",
      description: "A run of live events",
      createdAt: new Date("2026-04-01T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-04-01T00:00:00.000Z").toISOString(),
      _count: { events: 0 },
    });
    eventFindFirstMock
      .mockResolvedValueOnce({
        id: "event-1",
        organizerProfileId: "org-profile-1",
        status: "DRAFT",
        ticketTypes: [],
        startAt: new Date("2026-05-10T18:00:00.000Z"),
        endAt: new Date("2026-05-10T21:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "event-1",
        organizerProfileId: "org-profile-1",
        status: "DRAFT",
        ticketTypes: [],
        startAt: new Date("2026-05-10T18:00:00.000Z"),
        endAt: new Date("2026-05-10T21:00:00.000Z"),
      });
    eventSeriesFindFirstMock.mockResolvedValue({ id: seriesId });
    eventUpdateMock.mockResolvedValue({
      id: "event-1",
      title: "Opening Night",
      status: "DRAFT",
      series: { id: seriesId, title: "Spring Sessions" },
      ticketTypes: [],
      startAt: new Date("2026-05-10T18:00:00.000Z"),
      endAt: new Date("2026-05-10T21:00:00.000Z"),
      _count: { orders: 0, waitlist: 0 },
      orders: [],
    });
    eventSeriesFindUniqueMock.mockResolvedValue({
      id: seriesId,
      title: "Spring Sessions",
      description: "A run of live events",
      events: [
        {
          id: "event-1",
          slug: "opening-night",
          title: "Opening Night",
          heroImage: null,
          startAt: new Date("2026-05-10T18:00:00.000Z"),
          category: { id: "cat-1", name: "Music" },
          venue: { id: "venue-1", name: "Town Hall" },
          state: { id: "state-1", name: "Dhaka" },
          city: { id: "city-1", name: "Dhaka" },
          ticketTypes: [
            {
              id: "ticket-1",
              name: "General",
              price: 30,
              quantity: 100,
              sold: 10,
              reservedQty: 0,
            },
          ],
        },
      ],
    });
  });

  it("creates a series via organizer API", async () => {
    const req = new NextRequest("http://localhost/api/organizer/series", {
      method: "POST",
      body: JSON.stringify({ title: "Spring Sessions", description: "A run of live events" }),
      headers: { "content-type": "application/json" },
    });

    const res = await createSeriesPost(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.data.title).toBe("Spring Sessions");
    expect(eventSeriesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizerProfileId: "org-profile-1",
          title: "Spring Sessions",
        }),
      }),
    );
  });

  it("links an event to a series via organizer event patch", async () => {
    const req = new NextRequest("http://localhost/api/organizer/events/event-1", {
      method: "PATCH",
      body: JSON.stringify({ seriesId }),
      headers: { "content-type": "application/json" },
    });

    const res = await patchEventPost(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.series.id).toBe(seriesId);
    expect(eventUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seriesId,
        }),
      }),
    );
  });

  it("returns published events from the public series endpoint", async () => {
    const req = new NextRequest(`http://localhost/api/public/series/${seriesId}`, { method: "GET" });

    const res = await publicSeriesGet(req, { params: Promise.resolve({ id: seriesId }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.title).toBe("Spring Sessions");
    expect(payload.data.events).toHaveLength(1);
    expect(payload.data.events[0].slug).toBe("opening-night");
  });
});
