import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  organizerFindUniqueMock,
  orderFindManyMock,
  requireRoleMock,
  sendMonthlyRevenueReportMock,
} = vi.hoisted(() => ({
  organizerFindUniqueMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  requireRoleMock: vi.fn(),
  sendMonthlyRevenueReportMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: {
      findUnique: organizerFindUniqueMock,
    },
    order: {
      findMany: orderFindManyMock,
    },
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/notifications", () => ({
  sendMonthlyRevenueReport: sendMonthlyRevenueReportMock,
}));

import { POST } from "@/app/api/admin/reports/send-monthly/route";

describe("monthly report integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });
    organizerFindUniqueMock.mockResolvedValue({
      id: "org-1",
      brandName: "Tech Org",
      companyName: null,
      user: {
        email: "organizer@example.com",
      },
    });
    orderFindManyMock.mockResolvedValue([
      {
        total: 120,
        platformFee: 12,
        event: {
          title: "City Expo",
        },
      },
      {
        total: 80,
        platformFee: 8,
        event: {
          title: "City Expo",
        },
      },
      {
        total: 150,
        platformFee: 15,
        event: {
          title: "Design Summit",
        },
      },
    ]);
    sendMonthlyRevenueReportMock.mockResolvedValue({ sent: true, skipped: false });
  });

  it("sends a monthly revenue report for a super admin", async () => {
    const req = new NextRequest("http://localhost/api/admin/reports/send-monthly", {
      method: "POST",
      body: JSON.stringify({
        organizerProfileId: "org-1",
        month: "2026-03",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data).toEqual({
      sent: true,
      email: "organizer@example.com",
    });
    expect(orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PAID",
          event: {
            organizerProfileId: "org-1",
          },
        }),
      }),
    );
    expect(sendMonthlyRevenueReportMock).toHaveBeenCalledWith({
      organizerEmail: "organizer@example.com",
      brandName: "Tech Org",
      month: "2026-03",
      totalRevenue: 350,
      totalOrders: 3,
      topEvent: { title: "City Expo", revenue: 200 },
      platformFeeDeducted: 35,
    });
  });

  it("returns 403 for non-admin users", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("FORBIDDEN"));

    const req = new NextRequest("http://localhost/api/admin/reports/send-monthly", {
      method: "POST",
      body: JSON.stringify({
        organizerProfileId: "org-1",
        month: "2026-03",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(sendMonthlyRevenueReportMock).not.toHaveBeenCalled();
  });
});
