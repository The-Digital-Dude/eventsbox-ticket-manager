import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  eventFindManyMock,
  queryRawMock,
} = vi.hoisted(() => ({
  eventFindManyMock: vi.fn(),
  queryRawMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      findMany: eventFindManyMock,
    },
    $queryRaw: queryRawMock,
  },
}));

import { GET as getPublicEvents } from "@/app/api/public/events/route";
import { GET as getNearbyEvents } from "@/app/api/public/events/nearby/route";

describe("public discovery integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    eventFindManyMock.mockImplementation(async (args?: { where?: { categoryId?: string } }) => {
      if (args?.where?.categoryId === "category-music") {
        return [
          {
            id: "event-1",
            title: "Music Night",
            description: "Live music keyword show",
            slug: "music-night",
            status: "PUBLISHED",
            startAt: new Date("2026-04-10T18:00:00.000Z"),
            endAt: new Date("2026-04-10T21:00:00.000Z"),
            ticketTypes: [],
            category: { id: "category-music", name: "Music" },
            venue: null,
            state: null,
            city: null,
            organizerProfile: null,
          },
        ];
      }

      return [
        {
          id: "event-1",
          title: "Music Night",
          description: "Live music keyword show",
          slug: "music-night",
          status: "PUBLISHED",
          startAt: new Date("2026-04-10T18:00:00.000Z"),
          endAt: new Date("2026-04-10T21:00:00.000Z"),
          ticketTypes: [],
          category: { id: "category-music", name: "Music" },
          venue: null,
          state: null,
          city: null,
          organizerProfile: null,
        },
      ];
    });

    queryRawMock.mockResolvedValue([{ id: "event-nearby-1", distance_km: 3.25 }]);
  });

  it("filters published events by search keyword", async () => {
    const res = await getPublicEvents(new NextRequest("http://localhost/api/public/events?q=keyword"));
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(eventFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PUBLISHED",
          OR: [
            { title: { contains: "keyword", mode: "insensitive" } },
            { description: { contains: "keyword", mode: "insensitive" } },
          ],
        }),
      }),
    );
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].status).toBe("PUBLISHED");
  });

  it("filters published events by category", async () => {
    const res = await getPublicEvents(
      new NextRequest("http://localhost/api/public/events?category=category-music"),
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(eventFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PUBLISHED",
          categoryId: "category-music",
        }),
      }),
    );
    expect(payload.data[0].category.id).toBe("category-music");
  });

  it("returns nearby published events within the requested radius", async () => {
    eventFindManyMock.mockReset();
    eventFindManyMock.mockResolvedValueOnce([
      {
        id: "event-nearby-1",
        title: "Nearby Festival",
        slug: "nearby-festival",
        status: "PUBLISHED",
        startAt: new Date("2026-04-11T18:00:00.000Z"),
        endAt: new Date("2026-04-11T22:00:00.000Z"),
        category: { id: "category-music", name: "Music" },
        venue: { id: "venue-1", name: "Town Hall" },
        city: { id: "city-1", name: "Dhaka" },
        ticketTypes: [],
      },
    ]);

    const res = await getNearbyEvents(
      new NextRequest("http://localhost/api/public/events/nearby?lat=23.7&lng=90.4&radiusKm=50"),
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(eventFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["event-nearby-1"] } },
      }),
    );
    expect(payload.data.radiusKm).toBe(50);
    expect(payload.data.events).toHaveLength(1);
    expect(payload.data.events[0].distanceKm).toBe(3.25);
  });

  it("returns 400 when nearby search is missing coords", async () => {
    const res = await getNearbyEvents(
      new NextRequest("http://localhost/api/public/events/nearby"),
    );
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_COORDS");
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});
