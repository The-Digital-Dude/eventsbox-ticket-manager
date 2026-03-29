import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  aggregateMock,
  countMock,
  findManyMock,
  findManyOrderItemsMock,
  requireRoleMock,
  groupByMock,
  organizerCountMock,
  attendeeCountMock,
  reviewAggregateMock,
  affiliateLinkFindManyMock,
} = vi.hoisted(() => ({
  aggregateMock: vi.fn(),
  countMock: vi.fn(),
  findManyMock: vi.fn(),
  findManyOrderItemsMock: vi.fn(),
  requireRoleMock: vi.fn(),
  groupByMock: vi.fn(),
  organizerCountMock: vi.fn(),
  attendeeCountMock: vi.fn(),
  reviewAggregateMock: vi.fn(),
  affiliateLinkFindManyMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    order: {
      aggregate: aggregateMock,
      count: countMock,
      findMany: findManyMock,
      groupBy: groupByMock,
    },
    orderItem: {
      findMany: findManyOrderItemsMock,
    },
    organizerProfile: {
      count: organizerCountMock,
    },
    attendeeProfile: {
      count: attendeeCountMock,
    },
    eventReview: {
      aggregate: reviewAggregateMock,
    },
    affiliateLink: {
      findMany: affiliateLinkFindManyMock,
    },
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

import { GET } from "@/app/api/admin/analytics/route";

describe("admin analytics extended integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });
    aggregateMock
      .mockResolvedValueOnce({
        _sum: {
          total: 900,
          platformFee: 90,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          total: 120,
        },
      });
    countMock.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    findManyMock.mockResolvedValue([
      {
        eventId: "event-1",
        total: 300,
        paidAt: new Date("2026-03-01T09:00:00.000Z"),
        event: {
          title: "Dhaka Tech Conference",
          commissionPct: 10,
          category: { name: "Technology" },
          organizerProfile: {
            id: "org-1",
            brandName: "Tech Org",
            companyName: null,
            user: { email: "tech@example.com" },
          },
        },
        items: [{ quantity: 3 }],
      },
      {
        eventId: "event-2",
        total: 250,
        paidAt: new Date("2026-03-02T09:00:00.000Z"),
        event: {
          title: "Startup Summit",
          commissionPct: 8,
          category: { name: "Business" },
          organizerProfile: {
            id: "org-2",
            brandName: null,
            companyName: "Startup House",
            user: { email: "startup@example.com" },
          },
        },
        items: [{ quantity: 2 }],
      },
      {
        eventId: "event-3",
        total: 350,
        paidAt: new Date("2026-03-03T09:00:00.000Z"),
        event: {
          title: "Founder Mixer",
          commissionPct: 12,
          category: { name: "Business" },
          organizerProfile: {
            id: "org-2",
            brandName: null,
            companyName: "Startup House",
            user: { email: "startup@example.com" },
          },
        },
        items: [{ quantity: 4 }],
      },
    ]);
    findManyOrderItemsMock.mockResolvedValue([{ quantity: 3 }, { quantity: 2 }, { quantity: 4 }]);
    groupByMock.mockResolvedValue([]);
    organizerCountMock.mockResolvedValue(3);
    attendeeCountMock.mockResolvedValue(11);
    reviewAggregateMock.mockResolvedValue({
      _avg: { rating: 4.8 },
      _count: { id: 12 },
    });
    affiliateLinkFindManyMock.mockResolvedValue([]);
  });

  it("returns extended platform metrics", async () => {
    const req = new NextRequest("http://localhost/api/admin/analytics");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.platformRevenue).toBe(900);
    expect(payload.data.platformCommission).toBe(92);
    expect(payload.data.topOrganizers).toEqual([
      {
        organizerId: "org-2",
        brandName: "Startup House",
        revenue: 600,
        events: 2,
      },
      {
        organizerId: "org-1",
        brandName: "Tech Org",
        revenue: 300,
        events: 1,
      },
    ]);
    expect(payload.data.revenueByCategory).toEqual([
      {
        categoryName: "Business",
        revenue: 600,
        orders: 2,
      },
      {
        categoryName: "Technology",
        revenue: 300,
        orders: 1,
      },
    ]);
    expect(payload.data.newOrganizersThisMonth).toBe(3);
    expect(payload.data.newAttendeesThisMonth).toBe(11);
  });
});
