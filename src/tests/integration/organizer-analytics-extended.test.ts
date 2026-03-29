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

describe("organizer analytics extended integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "org-user-1", role: "ORGANIZER" });
    findProfileMock.mockResolvedValue({ id: "org-profile-1" });
    findEventsMock.mockResolvedValue([
      {
        id: "event-1",
        title: "City Expo",
        status: "PUBLISHED",
        startAt: new Date("2026-04-10T10:00:00.000Z"),
        ticketTypes: [
          { quantity: 100, sold: 30 },
          { quantity: 25, sold: 10 },
        ],
        orders: [
          {
            total: 180,
            platformFee: 18,
            paidAt: new Date("2026-04-01T08:00:00.000Z"),
            tickets: [
              { checkedInAt: new Date("2026-04-10T10:00:00.000Z"), isCheckedIn: true },
              { checkedInAt: null, isCheckedIn: false },
            ],
          },
        ],
      },
    ]);
    findOrdersMock.mockImplementation(async (args?: { select?: Record<string, unknown>; orderBy?: { paidAt?: string } }) => {
      if (args?.select?.items) {
        return [
          {
            total: 180,
            paidAt: new Date("2026-04-01T08:00:00.000Z"),
            items: [{ quantity: 2 }, { quantity: 1 }],
          },
          {
            total: 90,
            paidAt: new Date("2026-04-02T08:00:00.000Z"),
            items: [{ quantity: 1 }],
          },
        ];
      }

      if (args?.select?.promoCode) {
        return [
          {
            discountAmount: 10,
            promoCode: { code: "SPRING10" },
          },
          {
            discountAmount: 5,
            promoCode: { code: "SPRING10" },
          },
        ];
      }

      if (args?.select?.affiliateLink) {
        return [
          {
            total: 180,
            affiliateLink: { code: "AFF-1", label: "Campus Crew" },
          },
        ];
      }

      if (args?.orderBy?.paidAt === "asc") {
        return [
          {
            total: 180,
            paidAt: new Date("2026-04-01T08:00:00.000Z"),
          },
          {
            total: 90,
            paidAt: new Date("2026-04-02T08:00:00.000Z"),
          },
        ];
      }

      return [];
    });
    findOrderItemsMock.mockResolvedValue([
      {
        quantity: 2,
        subtotal: 120,
        ticketType: { name: "General Admission" },
      },
      {
        quantity: 1,
        subtotal: 60,
        ticketType: { name: "VIP" },
      },
      {
        quantity: 1,
        subtotal: 90,
        ticketType: { name: "General Admission" },
      },
    ]);
    findOrderAddOnsMock.mockResolvedValue([
      {
        name: "Meal Voucher",
        quantity: 3,
        subtotal: 30,
      },
      {
        name: "Parking Pass",
        quantity: 1,
        subtotal: 12,
      },
    ]);
    aggregateReviewsMock.mockResolvedValue({
      _avg: { rating: 4.2 },
      _count: { id: 5 },
    });
  });

  it("returns extended revenue breakdowns", async () => {
    const req = new NextRequest("http://localhost/api/organizer/analytics?months=3");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.revenueByTicketType).toEqual([
      { ticketTypeName: "General Admission", revenue: 210, sold: 3 },
      { ticketTypeName: "VIP", revenue: 60, sold: 1 },
    ]);
    expect(payload.data.revenueByPromoCode).toEqual([
      { code: "SPRING10", discount: 15, orders: 2 },
    ]);
    expect(payload.data.revenueByAddOn).toEqual([
      { addOnName: "Meal Voucher", revenue: 30, quantity: 3 },
      { addOnName: "Parking Pass", revenue: 12, quantity: 1 },
    ]);
    expect(payload.data.revenueByDay).toEqual([
      { date: "2026-04-01", revenue: 180, orders: 1 },
      { date: "2026-04-02", revenue: 90, orders: 1 },
    ]);
  });
});
