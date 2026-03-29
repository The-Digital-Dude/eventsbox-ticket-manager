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

describe("admin analytics integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });
    groupByMock.mockResolvedValue([
      {
        affiliateLinkId: "affiliate-1",
        _count: { id: 2 },
      },
    ]);
    affiliateLinkFindManyMock.mockResolvedValue([
      {
        id: "affiliate-1",
        code: "AFF-1",
        label: "Campus Crew",
      },
    ]);
    aggregateMock
      .mockResolvedValueOnce({
        _sum: {
          total: 450,
          platformFee: 45,
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          total: 75,
        },
      });
    countMock.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    organizerCountMock.mockResolvedValue(2);
    attendeeCountMock.mockResolvedValue(5);
    reviewAggregateMock.mockResolvedValue({
      _avg: {
        rating: 4.25,
      },
      _count: {
        id: 4,
      },
    });
    findManyMock.mockResolvedValue([
      {
        eventId: "event-1",
        total: 100,
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
        items: [{ quantity: 2 }],
      },
      {
        eventId: "event-1",
        total: 200,
        paidAt: new Date("2026-03-01T12:00:00.000Z"),
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
        items: [{ quantity: 1 }],
      },
      {
        eventId: "event-2",
        total: 150,
        paidAt: new Date("2026-03-02T10:00:00.000Z"),
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
        items: [{ quantity: 3 }],
      },
    ]);
    findManyOrderItemsMock.mockResolvedValue([{ quantity: 2 }, { quantity: 1 }, { quantity: 3 }]);
  });

  it("returns financial summary, top events, and revenue by day", async () => {
    const req = new NextRequest(
      "http://localhost/api/admin/analytics?from=2026-03-01T00:00:00.000Z&to=2026-03-31T23:59:59.999Z",
    );
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.summary).toEqual({
      grossRevenue: 450,
      platformFees: 45,
      refunded: 75,
      netRevenue: 375,
      ticketsSold: 6,
      ordersCount: 3,
      refundsCount: 1,
    });
    expect(payload.data.topEvents).toEqual([
      {
        eventId: "event-1",
        title: "Dhaka Tech Conference",
        revenue: 300,
        ticketsSold: 3,
      },
      {
        eventId: "event-2",
        title: "Startup Summit",
        revenue: 150,
        ticketsSold: 3,
      },
    ]);
    expect(payload.data.revenueByDay).toEqual([
      { date: "2026-03-01", revenue: 300 },
      { date: "2026-03-02", revenue: 150 },
    ]);
    expect(payload.data.reviewStats).toEqual({
      totalReviews: 4,
      averageRating: 4.3,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));

    const req = new NextRequest("http://localhost/api/admin/analytics");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("UNAUTHENTICATED");
  });
});
