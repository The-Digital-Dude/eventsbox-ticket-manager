import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  findProfileMock,
  findOrderMock,
  requireRoleMock,
  refundPaidOrderMock,
  notifyWaitlistMock,
} = vi.hoisted(() => ({
  findProfileMock: vi.fn(),
  findOrderMock: vi.fn(),
  requireRoleMock: vi.fn(),
  refundPaidOrderMock: vi.fn(),
  notifyWaitlistMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: { findUnique: findProfileMock },
    order: { findFirst: findOrderMock },
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/order-refund", () => ({
  refundPaidOrder: refundPaidOrderMock,
}));

vi.mock("@/src/lib/services/waitlist", () => ({
  notifyWaitlist: notifyWaitlistMock,
}));

import { POST } from "@/app/api/organizer/events/[id]/orders/[orderId]/refund/route";

describe("organizer order refund integration", () => {
  beforeEach(() => {
    findProfileMock.mockReset();
    findOrderMock.mockReset();
    requireRoleMock.mockReset();
    refundPaidOrderMock.mockReset();
    notifyWaitlistMock.mockReset();

    requireRoleMock.mockResolvedValue({ sub: "org-user-1", role: "ORGANIZER" });
    findProfileMock.mockResolvedValue({ id: "org-profile-1" });
    findOrderMock.mockResolvedValue({ id: "order-1", items: [] });
    refundPaidOrderMock.mockResolvedValue({
      success: true,
      data: { orderId: "order-1", status: "REFUNDED", refundId: "re_123" },
    });
    notifyWaitlistMock.mockResolvedValue(undefined);
  });

  it("refunds a paid order on a non-cancelled organizer event", async () => {
    const req = new NextRequest("http://localhost/api/organizer/events/event-1/orders/order-1/refund", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1", orderId: "order-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe("REFUNDED");
    expect(refundPaidOrderMock).toHaveBeenCalledWith("order-1", { allowAnyEventStatus: true });
  });

  it("returns 404 when order does not belong to organizer event", async () => {
    findOrderMock.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/organizer/events/event-1/orders/order-1/refund", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1", orderId: "order-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(refundPaidOrderMock).not.toHaveBeenCalled();
  });

  it("maps domain validation errors to 400", async () => {
    refundPaidOrderMock.mockResolvedValueOnce({
      success: false,
      error: { code: "EVENT_NOT_CANCELLED", message: "Order can be refunded only when event is cancelled" },
    });
    const req = new NextRequest("http://localhost/api/organizer/events/event-1/orders/order-1/refund", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1", orderId: "order-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("EVENT_NOT_CANCELLED");
  });
});
