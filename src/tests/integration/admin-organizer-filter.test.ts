import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { findManyMock, requireRoleMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  requireRoleMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: {
      findMany: findManyMock,
    },
  },
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

import { GET } from "@/app/api/admin/organizers/route";

describe("admin organizer filter integration", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ sub: "admin-id", role: "SUPER_ADMIN" });
    findManyMock.mockResolvedValue([]);
  });

  it("returns 200 with no params", async () => {
    const req = new NextRequest("http://localhost/api/admin/organizers");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it("returns 200 with status=APPROVED", async () => {
    const req = new NextRequest("http://localhost/api/admin/organizers?status=APPROVED");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          approvalStatus: "APPROVED",
        },
      }),
    );
  });

  it("returns 200 with q=test", async () => {
    const req = new NextRequest("http://localhost/api/admin/organizers?q=test");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { user: { email: { contains: "test", mode: "insensitive" } } },
            { companyName: { contains: "test", mode: "insensitive" } },
            { brandName: { contains: "test", mode: "insensitive" } },
            { contactName: { contains: "test", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("returns 200 with combined status and q", async () => {
    const req = new NextRequest("http://localhost/api/admin/organizers?status=APPROVED&q=test");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          approvalStatus: "APPROVED",
          OR: [
            { user: { email: { contains: "test", mode: "insensitive" } } },
            { companyName: { contains: "test", mode: "insensitive" } },
            { brandName: { contains: "test", mode: "insensitive" } },
            { contactName: { contains: "test", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("treats whitespace-only q as absent", async () => {
    const req = new NextRequest("http://localhost/api/admin/organizers?q=%20%20");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it("returns 400 for invalid status", async () => {
    const req = new NextRequest("http://localhost/api/admin/organizers?status=BOGUS");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("INVALID_STATUS");
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns 403 when unauthenticated", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    const req = new NextRequest("http://localhost/api/admin/organizers");
    const res = await GET(req);

    expect(res.status).toBe(403);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
