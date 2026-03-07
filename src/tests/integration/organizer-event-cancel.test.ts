import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  findProfileMock,
  findEventMock,
  countOrdersMock,
  updateEventMock,
  requireRoleMock,
  notifyAttendeesMock,
} = vi.hoisted(() => ({
  findProfileMock: vi.fn(),
  findEventMock: vi.fn(),
  countOrdersMock: vi.fn(),
  updateEventMock: vi.fn(),
  requireRoleMock: vi.fn(),
  notifyAttendeesMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: {
      findUnique: findProfileMock,
    },
    event: {
      findFirst: findEventMock,
      update: updateEventMock,
    },
    order: {
      count: countOrdersMock,
    },
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/notifications", () => ({
  notifyAttendeesOfEventCancellation: notifyAttendeesMock,
}));

import { POST } from "@/app/api/organizer/events/[id]/cancel/route";

describe("organizer event cancel integration", () => {
  beforeEach(() => {
    findProfileMock.mockReset();
    findEventMock.mockReset();
    countOrdersMock.mockReset();
    updateEventMock.mockReset();
    requireRoleMock.mockReset();
    notifyAttendeesMock.mockReset();

    requireRoleMock.mockResolvedValue({ sub: "org-user-1", role: "ORGANIZER" });
    findProfileMock.mockResolvedValue({ id: "org-profile-1" });
    findEventMock.mockResolvedValue({ id: "event-1", status: "PUBLISHED" });
    countOrdersMock.mockResolvedValue(0);
    updateEventMock.mockResolvedValue({ id: "event-1", status: "CANCELLED" });
    notifyAttendeesMock.mockResolvedValue({ recipients: 0, sent: 0 });
  });

  it("cancels a published event with no paid orders", async () => {
    const req = new NextRequest("http://localhost/api/organizer/events/event-1/cancel", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe("CANCELLED");
    expect(payload.data.paidOrdersCount).toBe(0);
    expect(updateEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "event-1" },
        data: { status: "CANCELLED" },
      }),
    );
    expect(notifyAttendeesMock).toHaveBeenCalledWith("event-1");
  });

  it("blocks cancellation when paid orders exist and no acknowledgement is provided", async () => {
    countOrdersMock.mockResolvedValueOnce(3);
    const req = new NextRequest("http://localhost/api/organizer/events/event-1/cancel", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("PAID_ORDERS_EXIST");
    expect(updateEventMock).not.toHaveBeenCalled();
  });

  it("allows cancellation with acknowledgement when paid orders exist", async () => {
    countOrdersMock.mockResolvedValueOnce(2);
    const req = new NextRequest("http://localhost/api/organizer/events/event-1/cancel", {
      method: "POST",
      body: JSON.stringify({ acknowledgePaidOrders: true }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.paidOrdersCount).toBe(2);
    expect(updateEventMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for non-published events", async () => {
    findEventMock.mockResolvedValueOnce({ id: "event-1", status: "DRAFT" });
    const req = new NextRequest("http://localhost/api/organizer/events/event-1/cancel", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("INVALID_STATUS");
    expect(countOrdersMock).not.toHaveBeenCalled();
    expect(updateEventMock).not.toHaveBeenCalled();
  });

  it("returns 404 when event is missing", async () => {
    findEventMock.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/organizer/events/event-1/cancel", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(updateEventMock).not.toHaveBeenCalled();
  });
});
