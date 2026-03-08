import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireRoleMock,
  eventFindUniqueMock,
  eventUpdateMock,
  writeAuditLogMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  eventFindUniqueMock: vi.fn(),
  eventUpdateMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/server-auth", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      findUnique: eventFindUniqueMock,
      update: eventUpdateMock,
    },
  },
}));

import { POST as featureEventPost } from "@/app/api/admin/events/[id]/feature/route";

describe("featured events integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "admin-user-1", role: "SUPER_ADMIN" });
    writeAuditLogMock.mockResolvedValue(undefined);

    eventFindUniqueMock.mockResolvedValue({
      id: "event-1",
      isFeatured: false,
    });
    eventUpdateMock.mockResolvedValue({
      id: "event-1",
      isFeatured: true,
    });
  });

  it("admin features an event", async () => {
    const req = new NextRequest("http://localhost/api/admin/events/event-1/feature", {
      method: "POST",
      body: JSON.stringify({ isFeatured: true }),
      headers: { "content-type": "application/json" },
    });

    const res = await featureEventPost(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.isFeatured).toBe(true);
    expect(eventUpdateMock).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { isFeatured: true },
      select: { id: true, isFeatured: true },
    });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EVENT_FEATURED",
        entityType: "Event",
        entityId: "event-1",
      }),
    );
  });

  it("admin unfeatures an event", async () => {
    eventFindUniqueMock.mockResolvedValueOnce({ id: "event-1", isFeatured: true });
    eventUpdateMock.mockResolvedValueOnce({ id: "event-1", isFeatured: false });

    const req = new NextRequest("http://localhost/api/admin/events/event-1/feature", {
      method: "POST",
      body: JSON.stringify({ isFeatured: false }),
      headers: { "content-type": "application/json" },
    });

    const res = await featureEventPost(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.isFeatured).toBe(false);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EVENT_UNFEATURED",
        entityType: "Event",
        entityId: "event-1",
      }),
    );
  });

  it("returns 403 for non-admin user", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("FORBIDDEN"));

    const req = new NextRequest("http://localhost/api/admin/events/event-1/feature", {
      method: "POST",
      body: JSON.stringify({ isFeatured: true }),
      headers: { "content-type": "application/json" },
    });

    const res = await featureEventPost(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(eventUpdateMock).not.toHaveBeenCalled();
  });
});
