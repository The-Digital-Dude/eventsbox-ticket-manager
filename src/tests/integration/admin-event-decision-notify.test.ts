import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  findEventMock,
  updateEventMock,
  requireRoleMock,
  sendOrganizerStatusMock,
} = vi.hoisted(() => ({
  findEventMock: vi.fn(),
  updateEventMock: vi.fn(),
  requireRoleMock: vi.fn(),
  sendOrganizerStatusMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      findUnique: findEventMock,
      update: updateEventMock,
    },
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/notifications", () => ({
  sendOrganizerEventStatusEmail: sendOrganizerStatusMock,
}));

import { POST } from "@/app/api/admin/events/[id]/decision/route";

describe("admin event decision notification integration", () => {
  beforeEach(() => {
    findEventMock.mockReset();
    updateEventMock.mockReset();
    requireRoleMock.mockReset();
    sendOrganizerStatusMock.mockReset();

    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });
    findEventMock.mockResolvedValue({
      id: "event-1",
      title: "City Fest",
      status: "PENDING_APPROVAL",
      organizerProfile: { user: { email: "org@example.com" } },
    });
    updateEventMock.mockResolvedValue({ id: "event-1", status: "PUBLISHED" });
    sendOrganizerStatusMock.mockResolvedValue({ sent: true, skipped: false });
  });

  it("publishes event and notifies organizer", async () => {
    const req = new NextRequest("http://localhost/api/admin/events/event-1/decision", {
      method: "POST",
      body: JSON.stringify({ action: "PUBLISHED" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(200);
    expect(updateEventMock).toHaveBeenCalledTimes(1);
    expect(sendOrganizerStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "org@example.com",
        eventTitle: "City Fest",
        status: "PUBLISHED",
      }),
    );
  });

  it("rejects event and includes reason in notification", async () => {
    updateEventMock.mockResolvedValueOnce({ id: "event-1", status: "REJECTED" });
    const req = new NextRequest("http://localhost/api/admin/events/event-1/decision", {
      method: "POST",
      body: JSON.stringify({ action: "REJECTED", reason: "Missing details" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(200);
    expect(sendOrganizerStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "REJECTED",
        reason: "Missing details",
      }),
    );
  });

  it("returns 400 when event is not pending approval", async () => {
    findEventMock.mockResolvedValueOnce({
      id: "event-1",
      title: "City Fest",
      status: "PUBLISHED",
      organizerProfile: { user: { email: "org@example.com" } },
    });
    const req = new NextRequest("http://localhost/api/admin/events/event-1/decision", {
      method: "POST",
      body: JSON.stringify({ action: "REJECTED" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_STATUS");
    expect(sendOrganizerStatusMock).not.toHaveBeenCalled();
  });
});
