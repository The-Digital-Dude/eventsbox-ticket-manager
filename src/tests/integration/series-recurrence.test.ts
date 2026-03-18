import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { POST } from "@/app/api/organizer/series/[id]/generate/route";

const { requireRoleMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

describe("Series Recurrence Integration", () => {
  let orgId: string;
  let userId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.eventSeatBooking.deleteMany({ where: { event: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } } });
    await prisma.qRTicket.deleteMany({ where: { order: { event: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } } } });
    await prisma.orderItem.deleteMany({ where: { order: { event: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } } } });
    await prisma.order.deleteMany({ where: { event: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } } });
    await prisma.event.deleteMany({ where: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } });
    await prisma.eventSeries.deleteMany();
    await prisma.organizerProfile.deleteMany({ where: { user: { email: { in: ["org@test.com","org@example.com","att@test.com","attendee@example.com","buyer@example.com","organizer@example.com","one@example.com","two@example.com","Buyer@Example.com"] } } } });
    await prisma.user.deleteMany({ where: { email: { in: ["org@test.com","org@example.com","att@test.com","attendee@example.com","buyer@example.com","organizer@example.com","one@example.com","two@example.com","Buyer@Example.com"] } } });

    const user = await prisma.user.create({
      data: { email: "org@test.com", passwordHash: "h", role: "ORGANIZER" },
    });
    userId = user.id;

    const profile = await prisma.organizerProfile.create({
      data: { userId: user.id, companyName: "Org" },
    });
    orgId = profile.id;
  }, 30000);

  it("POST /api/organizer/series/[id]/generate creates events with correct intervals", async () => {
    requireRoleMock.mockResolvedValue({ sub: userId, role: "ORGANIZER" });

    const series = await prisma.eventSeries.create({
      data: {
        organizerProfileId: orgId,
        title: "Weekly Series",
        recurrenceType: "WEEKLY",
      },
    });

    const startAt = new Date("2026-04-01T10:00:00Z");
    const endAt = new Date("2026-04-01T12:00:00Z");

    await prisma.event.create({
      data: {
        organizerProfileId: orgId,
        seriesId: series.id,
        title: "First Event",
        slug: "first-event",
        startAt,
        endAt,
      },
    });

    const req = new NextRequest(`http://localhost/api/organizer/series/${series.id}/generate`, {
      method: "POST",
      body: JSON.stringify({ count: 3 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: series.id }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.created).toBe(3);

    const events = await prisma.event.findMany({
      where: { seriesId: series.id },
      orderBy: { startAt: "asc" },
    });

    expect(events).toHaveLength(4); // 1 original + 3 generated
    expect(events[1].startAt.toISOString()).toBe("2026-04-08T10:00:00.000Z");
    expect(events[2].startAt.toISOString()).toBe("2026-04-15T10:00:00.000Z");
    expect(events[3].startAt.toISOString()).toBe("2026-04-22T10:00:00.000Z");
  }, 30000);

  it("stops at recurrenceEndDate if set", async () => {
    requireRoleMock.mockResolvedValue({ sub: userId, role: "ORGANIZER" });

    const series = await prisma.eventSeries.create({
      data: {
        organizerProfileId: orgId,
        title: "Limited Series",
        recurrenceType: "DAILY",
        recurrenceEndDate: new Date("2026-04-03T23:59:59Z"),
      },
    });

    await prisma.event.create({
      data: {
        organizerProfileId: orgId,
        seriesId: series.id,
        title: "Event",
        slug: "event",
        startAt: new Date("2026-04-01T10:00:00Z"),
        endAt: new Date("2026-04-01T12:00:00Z"),
      },
    });

    const req = new NextRequest(`http://localhost/api/organizer/series/${series.id}/generate`, {
      method: "POST",
      body: JSON.stringify({ count: 10 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: series.id }) });
    const payload = await res.json();

    expect(payload.data.created).toBe(2); // April 2nd and April 3rd fit
  }, 30000);
});
