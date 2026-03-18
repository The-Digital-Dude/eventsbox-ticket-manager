import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAttendeeMock,
  requireRoleMock,
  attendeeProfileFindUniqueMock,
  orderFindFirstMock,
  cancellationRequestCreateMock,
  cancellationRequestFindFirstMock,
  cancellationRequestUpdateMock,
  refundPaidOrderMock,
  sendOrganizerCancellationRequestEmailMock,
  sendCancellationRejectedEmailMock,
  writeAuditLogMock,
  getStripeClientMock,
} = vi.hoisted(() => ({
  requireAttendeeMock: vi.fn(),
  requireRoleMock: vi.fn(),
  attendeeProfileFindUniqueMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  cancellationRequestCreateMock: vi.fn(),
  cancellationRequestFindFirstMock: vi.fn(),
  cancellationRequestUpdateMock: vi.fn(),
  refundPaidOrderMock: vi.fn(),
  sendOrganizerCancellationRequestEmailMock: vi.fn(),
  sendCancellationRejectedEmailMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  getStripeClientMock: vi.fn(),
}));

vi.mock("@/src/lib/stripe/client", () => ({
  getStripeClient: getStripeClientMock,
}));

vi.mock("@/src/lib/auth/require-attendee", () => ({
  requireAttendee: requireAttendeeMock,
}));

vi.mock("@/src/lib/auth/server-auth", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/order-refund", () => ({
  refundPaidOrder: refundPaidOrderMock,
}));

vi.mock("@/src/lib/services/notifications", () => ({
  sendOrganizerCancellationRequestEmail: sendOrganizerCancellationRequestEmailMock,
  sendCancellationRejectedEmail: sendCancellationRejectedEmailMock,
  sendOrderRefundedEmail: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/src/lib/services/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    $transaction: vi.fn().mockResolvedValue([{}, { id: "cancel-1", status: "PENDING" }]),
    attendeeProfile: {
      findUnique: attendeeProfileFindUniqueMock,
    },
    order: {
      findFirst: orderFindFirstMock,
      update: vi.fn(),
    },
    cancellationRequest: {
      create: cancellationRequestCreateMock,
      findFirst: cancellationRequestFindFirstMock,
      update: cancellationRequestUpdateMock,
      upsert: vi.fn().mockResolvedValue({ id: "cancel-1", status: "PENDING" }),
    },
  },
}));

import { POST as attendeeCancelPost } from "@/app/api/account/orders/[orderId]/cancel/route";
import { PATCH as organizerCancellationPatch } from "@/app/api/organizer/cancellation-requests/[id]/route";

describe("cancellation requests integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getStripeClientMock.mockReturnValue({
      refunds: { create: vi.fn().mockResolvedValue({ id: "re_123" }) },
    });

    requireAttendeeMock.mockResolvedValue({
      user: { id: "attendee-user-1", email: "attendee@example.com" },
    });
    requireRoleMock.mockResolvedValue({ sub: "organizer-user-1", role: "ORGANIZER" });

    attendeeProfileFindUniqueMock.mockResolvedValue({ id: "attendee-profile-1" });
    orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      buyerEmail: "attendee@example.com",
      buyerName: "Attendee",
      total: 100,
      stripePaymentIntentId: "pi_123",
      event: {
        title: "Concert",
        contactEmail: "organizer@example.com",
        cancellationDeadlineHours: 24,
        refundPercent: 100,
        startAt: new Date(Date.now() + 48 * 3600 * 1000), // 48 hours in future
      },
      cancellationRequest: null,
    });
    cancellationRequestCreateMock.mockResolvedValue({ id: "cancel-1", status: "PENDING" });

    cancellationRequestFindFirstMock.mockResolvedValue({
      id: "cancel-1",
      orderId: "order-1",
      status: "PENDING",
      order: {
        id: "order-1",
        buyerEmail: "attendee@example.com",
        buyerName: "Attendee",
        event: { title: "Concert" },
      },
    });

    cancellationRequestUpdateMock.mockResolvedValue({ id: "cancel-1", status: "APPROVED", adminNote: null, resolvedAt: new Date().toISOString() });
    refundPaidOrderMock.mockResolvedValue({
      success: true,
      data: {
        orderId: "order-1",
        status: "REFUNDED",
        refundId: "re_123",
      },
    });
    sendOrganizerCancellationRequestEmailMock.mockResolvedValue({ sent: true, skipped: false });
    sendCancellationRejectedEmailMock.mockResolvedValue({ sent: true, skipped: false });
  });

  it("creates attendee cancellation request", async () => {
    const req = new NextRequest("http://localhost/api/account/orders/order-1/cancel", {
      method: "POST",
      body: JSON.stringify({ reason: "Can no longer attend" }),
      headers: { "content-type": "application/json" },
    });

    const res = await attendeeCancelPost(req, { params: Promise.resolve({ orderId: "order-1" }) });
    const payload = await res.json();
expect(res.status).toBe(200);
expect(payload.data.refunded).toBe(true);
expect(payload.data.refundPct).toBe(100);
  });

  it("returns 409 on duplicate cancellation request", async () => {
    orderFindFirstMock.mockResolvedValueOnce({
      id: "order-1",
      buyerEmail: "attendee@example.com",
      event: { title: "Concert", contactEmail: "organizer@example.com" },
      cancellationRequest: { id: "cancel-existing" },
    });

    const req = new NextRequest("http://localhost/api/account/orders/order-1/cancel", {
      method: "POST",
      body: JSON.stringify({ reason: "Duplicate" }),
      headers: { "content-type": "application/json" },
    });

    const res = await attendeeCancelPost(req, { params: Promise.resolve({ orderId: "order-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.error.code).toBe("ALREADY_REQUESTED");
  });

  it("organizer approves request and triggers REFUNDED flow", async () => {
    cancellationRequestUpdateMock.mockResolvedValueOnce({
      id: "cancel-1",
      status: "APPROVED",
      adminNote: null,
      resolvedAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost/api/organizer/cancellation-requests/cancel-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "APPROVE" }),
      headers: { "content-type": "application/json" },
    });

    const res = await organizerCancellationPatch(req, { params: Promise.resolve({ id: "cancel-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.status).toBe("APPROVED");
    expect(refundPaidOrderMock).toHaveBeenCalledWith("order-1", { allowAnyEventStatus: true });
  });

  it("organizer rejects request and marks REJECTED", async () => {
    cancellationRequestUpdateMock.mockResolvedValueOnce({
      id: "cancel-1",
      status: "REJECTED",
      adminNote: "Outside refund policy",
      resolvedAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost/api/organizer/cancellation-requests/cancel-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "REJECT", adminNote: "Outside refund policy" }),
      headers: { "content-type": "application/json" },
    });

    const res = await organizerCancellationPatch(req, { params: Promise.resolve({ id: "cancel-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.status).toBe("REJECTED");
    expect(sendCancellationRejectedEmailMock).toHaveBeenCalled();
  });
});
