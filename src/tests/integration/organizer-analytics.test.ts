import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  findProfileMock,
  findEventsMock,
  findOrdersMock,
  findOrderItemsMock,
  findOrderAddOnsMock,
  aggregateReviewsMock,
  requireRoleMock,
} = vi.hoisted(() => ({
  findProfileMock: vi.fn(),
  findEventsMock: vi.fn(),
  findOrdersMock: vi.fn(),
  findOrderItemsMock: vi.fn(),
  findOrderAddOnsMock: vi.fn(),
  aggregateReviewsMock: vi.fn(),
  requireRoleMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: { findUnique: findProfileMock },
    event: { findMany: findEventsMock },
    order: { findMany: findOrdersMock },
    orderItem: { findMany: findOrderItemsMock },
    orderAddOn: { findMany: findOrderAddOnsMock },
    eventReview: { aggregate: aggregateReviewsMock },
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

import { GET } from "@/app/api/organizer/analytics/route";

describe("organizer analytics integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "org-user-1", role: "ORGANIZER" });
    findProfileMock.mockResolvedValue({ id: "org-profile-1" });
    findEventsMock.mockResolvedValue([
      {
        id: "event-1",
        title: "City Expo",
        status: "PUBLISHED",
        startAt: new Date("2026-01-10T10:00:00.000Z"),
        ticketTypes: [{ quantity: 100, sold: 32 }],
        orders: [
          {
            total: 120,
            platformFee: 10,
            paidAt: new Date("2026-02-01T08:00:00.000Z"),
            tickets: [
              { checkedInAt: null, isCheckedIn: false },
              { checkedInAt: new Date("2026-02-01T10:00:00.000Z"), isCheckedIn: true },
            ],
          },
        ],
      },
    ]);
    findOrdersMock.mockImplementation(async (args?: { select?: Record<string, unknown>; orderBy?: { paidAt?: string } }) => {
      if (args?.select?.items) {
        return [
          {
            total: 120,
            paidAt: new Date("2026-03-01T08:00:00.000Z"),
            items: [{ quantity: 2 }, { quantity: 1 }],
          },
        ];
      }

      if (args?.select?.promoCode) {
        return [
          {
            discountAmount: 15,
            promoCode: { code: "SPRING15" },
          },
        ];
      }

      if (args?.select?.affiliateLink) {
        return [
          {
            total: 120,
            affiliateLink: { code: "AFF-1", label: "Campus Crew" },
          },
        ];
      }

      if (args?.orderBy?.paidAt === "asc") {
        return [
          {
            total: 120,
            paidAt: new Date("2026-03-01T08:00:00.000Z"),
          },
        ];
      }

      return [];
    });
    findOrderItemsMock.mockResolvedValue([
      {
        quantity: 2,
        subtotal: 80,
        ticketType: { name: "General Admission" },
      },
      {
        quantity: 1,
        subtotal: 40,
        ticketType: { name: "VIP" },
      },
    ]);
    findOrderAddOnsMock.mockResolvedValue([
      {
        name: "Meal Voucher",
        quantity: 2,
        subtotal: 20,
      },
    ]);
    aggregateReviewsMock.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { id: 2 },
    });
  });

  it("returns analytics payload for a valid period", async () => {
    const req = new NextRequest("http://localhost/api/organizer/analytics?months=6");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.period.months).toBe(6);
    expect(payload.data.monthly).toHaveLength(6);
    expect(payload.data.summary.totalTicketsSold).toBe(32);
    const ticketSum = payload.data.monthly.reduce((sum: number, month: { tickets: number }) => sum + month.tickets, 0);
    expect(ticketSum).toBe(3);
    expect(payload.data.topEvents).toHaveLength(1);
    expect(payload.data.reviewSummary).toEqual({
      averageRating: 4.5,
      totalReviews: 2,
    });
  });

  it("falls back to 12 months for invalid period input", async () => {
    const req = new NextRequest("http://localhost/api/organizer/analytics?months=99");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.period.months).toBe(12);
    expect(payload.data.monthly).toHaveLength(12);
  });

  it("returns 401 when unauthenticated", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    const req = new NextRequest("http://localhost/api/organizer/analytics");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("UNAUTHENTICATED");
  });
});
