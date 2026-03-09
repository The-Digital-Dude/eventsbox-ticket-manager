import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireRoleMock,
  eventFindManyMock,
  eventUpdateManyMock,
  writeAuditLogMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  eventFindManyMock: vi.fn(),
  eventUpdateManyMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      findMany: eventFindManyMock,
      updateMany: eventUpdateManyMock,
    },
  },
}));

import { POST } from "@/app/api/admin/events/bulk/route";

describe("admin bulk events integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });
    eventFindManyMock.mockResolvedValue([
      { id: "event-1", status: "PENDING_APPROVAL", isFeatured: false },
      { id: "event-2", status: "PENDING_APPROVAL", isFeatured: true },
    ]);
    eventUpdateManyMock.mockResolvedValue({ count: 2 });
    writeAuditLogMock.mockResolvedValue(undefined);
  });

  it("bulk approves events and writes audit logs", async () => {
    const req = new NextRequest("http://localhost/api/admin/events/bulk", {
      method: "POST",
      body: JSON.stringify({ ids: ["event-1", "event-2"], action: "APPROVE" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.updated).toBe(2);
    expect(eventUpdateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["event-1", "event-2"] } },
      data: {
        status: "PUBLISHED",
        publishedAt: expect.any(Date),
        rejectionReason: null,
      },
    });
    expect(writeAuditLogMock).toHaveBeenCalledTimes(2);
    expect(writeAuditLogMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "EVENT_BULK_APPROVED",
        entityType: "Event",
        entityId: "event-1",
      }),
    );
  });

  it("bulk rejects events and writes audit logs", async () => {
    const req = new NextRequest("http://localhost/api/admin/events/bulk", {
      method: "POST",
      body: JSON.stringify({ ids: ["event-1", "event-2"], action: "REJECT" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.updated).toBe(2);
    expect(eventUpdateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["event-1", "event-2"] } },
      data: {
        status: "REJECTED",
        rejectionReason: "Rejected via bulk admin action",
      },
    });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EVENT_BULK_REJECTED",
      }),
    );
  });

  it("returns 403 for non-admin user", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("FORBIDDEN"));

    const req = new NextRequest("http://localhost/api/admin/events/bulk", {
      method: "POST",
      body: JSON.stringify({ ids: ["event-1"], action: "APPROVE" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(eventUpdateManyMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });
});
