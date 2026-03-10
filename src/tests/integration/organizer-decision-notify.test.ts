import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  updateOrganizerMock,
  findUserMock,
  requireRoleMock,
  writeAuditLogMock,
  sendOrganizerApprovedEmailMock,
  sendOrganizerRejectedEmailMock,
} = vi.hoisted(() => ({
  updateOrganizerMock: vi.fn(),
  findUserMock: vi.fn(),
  requireRoleMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  sendOrganizerApprovedEmailMock: vi.fn(),
  sendOrganizerRejectedEmailMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: {
      update: updateOrganizerMock,
    },
    user: {
      findUnique: findUserMock,
    },
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/src/lib/services/notifications", () => ({
  sendOrganizerApprovedEmail: sendOrganizerApprovedEmailMock,
  sendOrganizerRejectedEmail: sendOrganizerRejectedEmailMock,
}));

import { POST } from "@/app/api/admin/organizers/[id]/decision/route";

describe("organizer decision notification integration", () => {
  beforeEach(() => {
    updateOrganizerMock.mockReset();
    findUserMock.mockReset();
    requireRoleMock.mockReset();
    writeAuditLogMock.mockReset();
    sendOrganizerApprovedEmailMock.mockReset();
    sendOrganizerRejectedEmailMock.mockReset();

    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });
    updateOrganizerMock.mockResolvedValue({
      id: "org-profile-1",
      userId: "user-1",
      approvalStatus: "APPROVED",
    });
    findUserMock.mockResolvedValue({
      email: "organizer@example.com",
    });
    writeAuditLogMock.mockResolvedValue(undefined);
    sendOrganizerApprovedEmailMock.mockResolvedValue({ sent: true, skipped: false });
    sendOrganizerRejectedEmailMock.mockResolvedValue({ sent: true, skipped: false });
  });

  it("approves organizer and sends approval email", async () => {
    const req = new NextRequest("http://localhost/api/admin/organizers/org-profile-1/decision", {
      method: "POST",
      body: JSON.stringify({ action: "APPROVED" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "org-profile-1" }) });

    expect(res.status).toBe(200);
    expect(sendOrganizerApprovedEmailMock).toHaveBeenCalledWith({
      to: "organizer@example.com",
      organizerName: "organizer@example.com",
    });
    expect(sendOrganizerRejectedEmailMock).not.toHaveBeenCalled();
  });

  it("rejects organizer and sends rejection email with reason", async () => {
    updateOrganizerMock.mockResolvedValueOnce({
      id: "org-profile-1",
      userId: "user-1",
      approvalStatus: "REJECTED",
    });

    const req = new NextRequest("http://localhost/api/admin/organizers/org-profile-1/decision", {
      method: "POST",
      body: JSON.stringify({ action: "REJECTED", reason: "Missing business documents" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "org-profile-1" }) });

    expect(res.status).toBe(200);
    expect(sendOrganizerRejectedEmailMock).toHaveBeenCalledWith({
      to: "organizer@example.com",
      organizerName: "organizer@example.com",
      reason: "Missing business documents",
    });
    expect(sendOrganizerApprovedEmailMock).not.toHaveBeenCalled();
  });
});
