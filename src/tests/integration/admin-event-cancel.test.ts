import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  findEventMock,
  countOrdersMock,
  updateEventMock,
  requireRoleMock,
  notifyAttendeesMock,
  sendOrganizerStatusMock,
} = vi.hoisted(() => ({
  findEventMock: vi.fn(),
  countOrdersMock: vi.fn(),
  updateEventMock: vi.fn(),
  requireRoleMock: vi.fn(),
  notifyAttendeesMock: vi.fn(),
  sendOrganizerStatusMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      findUnique: findEventMock,
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
  sendOrganizerEventStatusEmail: sendOrganizerStatusMock,
}));

import { POST } from "@/app/api/admin/events/[id]/cancel/route";

describe("admin event cancel integration", () => {
  beforeEach(() => {
    findEventMock.mockReset();
    countOrdersMock.mockReset();
    updateEventMock.mockReset();
    requireRoleMock.mockReset();
    notifyAttendeesMock.mockReset();
    sendOrganizerStatusMock.mockReset();

    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });
    findEventMock.mockResolvedValue({
      id: "event-1",
      title: "Test Event",
      status: "PUBLISHED",
      organizerProfile: { user: { email: "org@example.com" } },
    });
    countOrdersMock.mockResolvedValue(4);
    updateEventMock.mockResolvedValue({ id: "event-1", status: "CANCELLED" });
    notifyAttendeesMock.mockResolvedValue({ recipients: 3, sent: 3 });
    sendOrganizerStatusMock.mockResolvedValue({ sent: true, skipped: false });
  });

  it("cancels a published event", async () => {
    const req = new NextRequest("http://localhost/api/admin/events/event-1/cancel", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe("CANCELLED");
    expect(payload.data.paidOrdersCount).toBe(4);
    expect(updateEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "event-1" },
        data: { status: "CANCELLED" },
      }),
    );
    expect(sendOrganizerStatusMock).toHaveBeenCalledTimes(1);
    expect(notifyAttendeesMock).toHaveBeenCalledWith("event-1");
  });

  it("returns 400 for non-published events", async () => {
    findEventMock.mockResolvedValueOnce({
      id: "event-1",
      title: "Test Event",
      status: "REJECTED",
      organizerProfile: { user: { email: "org@example.com" } },
    });
    const req = new NextRequest("http://localhost/api/admin/events/event-1/cancel", { method: "POST" });
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
    const req = new NextRequest("http://localhost/api/admin/events/event-1/cancel", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(updateEventMock).not.toHaveBeenCalled();
  });
});
