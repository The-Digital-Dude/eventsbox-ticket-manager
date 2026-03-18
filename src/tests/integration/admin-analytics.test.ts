import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  aggregateMock,
  countMock,
  findManyMock,
  findManyOrderItemsMock,
  requireRoleMock,
  groupByMock,
} = vi.hoisted(() => ({
  aggregateMock: vi.fn(),
  countMock: vi.fn(),
  findManyMock: vi.fn(),
  findManyOrderItemsMock: vi.fn(),
  requireRoleMock: vi.fn(),
  groupByMock: vi.fn(),
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
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

import { GET } from "@/app/api/admin/analytics/route";

describe("admin analytics integration", () => {
  beforeEach(() => {
    aggregateMock.mockReset();
    countMock.mockReset();
    findManyMock.mockReset();
    findManyOrderItemsMock.mockReset();
    requireRoleMock.mockReset();
    groupByMock.mockReset();

    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });
    groupByMock.mockResolvedValue([]);
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
    findManyMock.mockResolvedValue([
      {
        eventId: "event-1",
        total: 100,
        paidAt: new Date("2026-03-01T09:00:00.000Z"),
        event: { title: "Dhaka Tech Conference" },
        items: [{ quantity: 2 }],
      },
      {
        eventId: "event-1",
        total: 200,
        paidAt: new Date("2026-03-01T12:00:00.000Z"),
        event: { title: "Dhaka Tech Conference" },
        items: [{ quantity: 1 }],
      },
      {
        eventId: "event-2",
        total: 150,
        paidAt: new Date("2026-03-02T10:00:00.000Z"),
        event: { title: "Startup Summit" },
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
