import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
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
    await prisma.auditLog.deleteMany({ where: { actorUserId: "admin-1" } });
    await prisma.user.deleteMany({ where: { id: "admin-1" } });
    await prisma.platformConfig.deleteMany();
    await prisma.user.create({
      data: {
        id: "admin-1",
        email: "admin@example.com",
        passwordHash: "test-hash",
        role: Role.SUPER_ADMIN,
      },
    });
    await prisma.platformConfig.create({
      data: {
        id: "singleton",
        platformName: "EventsBox",
        supportEmail: "support@eventsbox.com",
        timezone: "Pacific/Auckland",
        defaultCurrency: "NZD",
        defaultLocale: "en-NZ",
        brandColor: "#000000",
        secondaryBrandColor: "#2563EB",
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
    expect(payload.data.supportEmail).toBe("support@eventsbox.com");
    expect(payload.data.defaultCurrency).toBe("NZD");
    expect(payload.data.brandColor).toBe("#000000");
    expect(payload.data.defaultEventApprovalRequired).toBe(true);
    expect(payload.data.featuredEventLimit).toBe(6);
    expect(payload.data.smtpFromName).toBe("EventsBox");
    expect(payload.data.smtpFromEmail).toBe("noreply@eventsbox.com");
  }, 30000);

  it("PUT /api/admin/config updates values", async () => {
    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });

    const update = {
      platformName: "TestBox",
      supportEmail: "support@testbox.com",
      timezone: "UTC",
      defaultCurrency: "USD",
      defaultLocale: "en-US",
      logoUrl: "",
      faviconUrl: "",
      brandColor: "#FF0000",
      secondaryBrandColor: "#00AAFF",
      footerText: "Test footer",
      defaultEventApprovalRequired: false,
      defaultOrganizerApprovalRequired: true,
      autoPublishMode: "APPROVED_ORGANIZERS",
      defaultCancellationPolicy: "Default cancellation policy",
      defaultCommissionType: "PERCENTAGE",
      defaultCommissionValue: 5,
      defaultTaxRate: 10,
      defaultFeeStrategy: "PASS_TO_BUYER",
      smtpFromName: "Tester",
      smtpFromEmail: "test@test.com",
      emailNotificationsEnabled: true,
      adminAlertsEnabled: true,
      organizerApprovalEmailEnabled: false,
      eventApprovalEmailEnabled: false,
      defaultMetaTitle: "TestBox events",
      defaultMetaDescription: "Discover TestBox events.",
      featuredEventLimit: 9,
      publicSearchEnabled: true,
      searchIndexingEnabled: true,
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
    expect(row?.defaultEventApprovalRequired).toBe(false);
    expect(row?.organizerApprovalEmailEnabled).toBe(false);
    expect(row?.featuredEventLimit).toBe(9);

    const auditLog = await prisma.auditLog.findFirst({
      where: { actorUserId: "admin-1", action: "PLATFORM_CONFIG_UPDATED" },
    });
    expect(auditLog).toBeTruthy();
  }, 30000);
});
