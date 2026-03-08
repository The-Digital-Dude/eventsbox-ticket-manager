import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  findProfileMock,
  findEventsMock,
  findOrdersMock,
  requireRoleMock,
} = vi.hoisted(() => ({
  findProfileMock: vi.fn(),
  findEventsMock: vi.fn(),
  findOrdersMock: vi.fn(),
  requireRoleMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: { findUnique: findProfileMock },
    event: { findMany: findEventsMock },
    order: { findMany: findOrdersMock },
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

import { GET } from "@/app/api/organizer/analytics/route";

describe("organizer analytics integration", () => {
  beforeEach(() => {
    findProfileMock.mockReset();
    findEventsMock.mockReset();
    findOrdersMock.mockReset();
    requireRoleMock.mockReset();

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
            tickets: [{ checkedInAt: null }, { checkedInAt: new Date("2026-02-01T10:00:00.000Z") }],
          },
        ],
      },
    ]);
    findOrdersMock.mockResolvedValue([
      {
        total: 120,
        paidAt: new Date(),
        items: [{ quantity: 2 }, { quantity: 1 }],
      },
    ]);
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
