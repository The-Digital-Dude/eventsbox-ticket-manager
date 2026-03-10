import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  findOrderMock,
  requireRoleMock,
  refundPaidOrderMock,
} = vi.hoisted(() => ({
  findOrderMock: vi.fn(),
  requireRoleMock: vi.fn(),
  refundPaidOrderMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    order: { findFirst: findOrderMock },
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/order-refund", () => ({
  refundPaidOrder: refundPaidOrderMock,
}));

import { POST } from "@/app/api/admin/events/[id]/orders/[orderId]/refund/route";

describe("admin order refund integration", () => {
  beforeEach(() => {
    findOrderMock.mockReset();
    requireRoleMock.mockReset();
    refundPaidOrderMock.mockReset();

    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });
    findOrderMock.mockResolvedValue({ id: "order-1" });
    refundPaidOrderMock.mockResolvedValue({
      success: true,
      data: { orderId: "order-1", status: "REFUNDED", refundId: "re_123" },
    });
  });

  it("refunds a paid order on a non-cancelled event as admin", async () => {
    const req = new NextRequest("http://localhost/api/admin/events/event-1/orders/order-1/refund", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1", orderId: "order-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe("REFUNDED");
    expect(refundPaidOrderMock).toHaveBeenCalledWith("order-1", { allowAnyEventStatus: true });
  });

  it("returns 404 when order is missing for event", async () => {
    findOrderMock.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/admin/events/event-1/orders/order-1/refund", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1", orderId: "order-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(refundPaidOrderMock).not.toHaveBeenCalled();
  });

  it("maps stripe errors to 500", async () => {
    refundPaidOrderMock.mockResolvedValueOnce({
      success: false,
      error: { code: "STRIPE_REFUND_FAILED", message: "Refund failed" },
    });
    const req = new NextRequest("http://localhost/api/admin/events/event-1/orders/order-1/refund", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1", orderId: "order-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("STRIPE_REFUND_FAILED");
  });
});
