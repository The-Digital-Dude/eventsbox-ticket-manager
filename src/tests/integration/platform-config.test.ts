import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { GET, PUT } from "@/app/api/admin/config/route";

const { requireRoleMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

describe("Platform Config Integration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.platformConfig.deleteMany();
    await prisma.platformConfig.create({
      data: {
        id: "singleton",
        platformName: "EventsBox",
        brandColor: "#000000",
        smtpFromName: "EventsBox",
        smtpFromEmail: "noreply@eventsbox.com",
        defaultCommissionPct: 10,
        defaultGstPct: 15,
        payoutModeDefault: "MANUAL",
      },
    });
  }, 30000);

  it("GET /api/admin/config returns new fields", async () => {
    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });

    const req = new NextRequest("http://localhost/api/admin/config");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.platformName).toBe("EventsBox");
    expect(payload.data.brandColor).toBe("#000000");
    expect(payload.data.smtpFromName).toBe("EventsBox");
    expect(payload.data.smtpFromEmail).toBe("noreply@eventsbox.com");
  }, 30000);

  it("PUT /api/admin/config updates values", async () => {
    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });

    const update = {
      platformName: "TestBox",
      brandColor: "#FF0000",
      smtpFromName: "Tester",
      smtpFromEmail: "test@test.com",
      defaultCommissionPct: 5,
      defaultGstPct: 10,
      payoutModeDefault: "STRIPE_CONNECT",
    };

    const req = new NextRequest("http://localhost/api/admin/config", {
      method: "PUT",
      body: JSON.stringify(update),
    });

    const res = await PUT(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.platformName).toBe("TestBox");

    const row = await prisma.platformConfig.findUnique({ where: { id: "singleton" } });
    expect(row?.platformName).toBe("TestBox");
    expect(row?.brandColor).toBe("#FF0000");
  }, 30000);
});
