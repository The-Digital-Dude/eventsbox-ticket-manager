import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireRoleMock,
  organizerProfileFindUniqueMock,
  eventFindFirstMock,
  eventUpdateMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  organizerProfileFindUniqueMock: vi.fn(),
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
    event: {
      findFirst: eventFindFirstMock,
      update: eventUpdateMock,
    },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { PATCH as patchEvent } from "@/app/api/organizer/events/[id]/route";
import { GET as getPublicEvent } from "@/app/api/public/events/[slug]/route";

describe("event gallery integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue({ sub: "organizer-user-1", role: "ORGANIZER" });
    organizerProfileFindUniqueMock.mockResolvedValue({ id: "org-profile-1" });
    eventFindFirstMock.mockResolvedValue({
      id: "event-1",
      organizerProfileId: "org-profile-1",
      status: "DRAFT",
      images: [],
      ticketTypes: [],
      startAt: new Date(),
      endAt: new Date(),
      category: null,
      venue: null,
      state: null,
      city: null,
      series: null,
      _count: { orders: 0, waitlist: 0 },
      orders: [],
    });
    eventUpdateMock.mockResolvedValue({
      id: "event-1",
      title: "Gallery Event",
      status: "DRAFT",
      images: ["https://example.com/a.jpg"],
      ticketTypes: [],
      startAt: new Date(),
      endAt: new Date(),
      category: null,
      venue: null,
      state: null,
      city: null,
      series: null,
      _count: { orders: 0, waitlist: 0 },
      orders: [],
    });
  });

  it("updates gallery images through organizer event patch", async () => {
    const req = new NextRequest("http://localhost/api/organizer/events/event-1", {
      method: "PATCH",
      body: JSON.stringify({ images: ["https://example.com/a.jpg"] }),
      headers: { "content-type": "application/json" },
    });

    const res = await patchEvent(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.images).toEqual(["https://example.com/a.jpg"]);
    expect(eventUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          images: ["https://example.com/a.jpg"],
        }),
      }),
    );
  });

  it("returns gallery images from the public event endpoint", async () => {
    eventFindFirstMock.mockResolvedValueOnce({
      id: "event-1",
      title: "Gallery Event",
      slug: "gallery-event",
      heroImage: null,
      images: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      venue: null,
      category: null,
      state: null,
      city: null,
      series: null,
      ticketTypes: [],
      organizerProfile: null,
    });

    const response = await getPublicEvent(
      new NextRequest("http://localhost/api/public/events/gallery-event"),
      { params: Promise.resolve({ slug: "gallery-event" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.images).toEqual([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
    ]);
  });
});
