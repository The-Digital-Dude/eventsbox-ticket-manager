import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { POST as createAffiliate } from "@/app/api/organizer/affiliate/route";
import { DELETE as deleteAffiliate } from "@/app/api/organizer/affiliate/[id]/route";
import { GET as trackAffiliate } from "@/app/api/public/affiliate/[code]/route";
import { POST as checkout } from "@/app/api/checkout/route";

const { requireRoleMock, getStripeClientMock, getServerSessionMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  getStripeClientMock: vi.fn(),
  getServerSessionMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/server-auth", () => ({
  requireRole: requireRoleMock,
  getServerSession: getServerSessionMock,
}));

vi.mock("@/src/lib/stripe/client", () => ({
  getStripeClient: getStripeClientMock,
}));

describe("affiliate tickets integration", () => {
  let orgId: string;
  let eventId: string;
  let ticketTypeId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    await prisma.affiliateLink.deleteMany({ where: { event: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } } });
    await prisma.eventSeatBooking.deleteMany({ where: { event: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } } });
    await prisma.qRTicket.deleteMany({ where: { order: { event: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } } } });
    await prisma.orderItem.deleteMany({ where: { order: { event: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } } } });
    await prisma.order.deleteMany({ where: { event: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } } });
    await prisma.ticketType.deleteMany({ where: { event: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } } });
    await prisma.event.deleteMany({ where: { slug: { in: ["test-event","first-event","gallery-event","opening-night","seat-test","summer-fest","event"] } } });
    await prisma.organizerProfile.deleteMany({ where: { user: { email: { in: ["org@test.com","org@example.com","att@test.com","attendee@example.com","buyer@example.com","organizer@example.com","one@example.com","two@example.com","Buyer@Example.com"] } } } });
    await prisma.user.deleteMany({ where: { email: { in: ["org@test.com","org@example.com","att@test.com","attendee@example.com","buyer@example.com","organizer@example.com","one@example.com","two@example.com","Buyer@Example.com"] } } });

    const user = await prisma.user.create({
      data: { email: "org@test.com", passwordHash: "hash", role: "ORGANIZER" },
    });

    const org = await prisma.organizerProfile.create({
      data: { userId: user.id, companyName: "Test Org" },
    });
    orgId = org.id;

    const event = await prisma.event.create({
      data: { organizerProfileId: org.id, title: "Test Event", slug: "test-event", status: "PUBLISHED", startAt: new Date(), endAt: new Date() },
    });
    eventId = event.id;

    const ticket = await prisma.ticketType.create({
      data: { eventId: event.id, name: "General", price: 10, quantity: 100 },
    });
    ticketTypeId = ticket.id;

    requireRoleMock.mockResolvedValue({ sub: user.id, role: "ORGANIZER" });
    getServerSessionMock.mockResolvedValue(null);
    getStripeClientMock.mockReturnValue({
      paymentIntents: { create: vi.fn().mockResolvedValue({ id: "pi_123", client_secret: "cs_123" }) },
    });
  }, 30000);

  it("POST /api/organizer/affiliate creates link with auto-generated code", async () => {
    const req = new NextRequest("http://localhost/api/organizer/affiliate", {
      method: "POST",
      body: JSON.stringify({ label: "Partner" }),
    });

    const res = await createAffiliate(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.data.label).toBe("Partner");
    expect(payload.data.code).toHaveLength(8);
  }, 30000);

  it("GET /api/public/affiliate/[code] increments clickCount", async () => {
    const link = await prisma.affiliateLink.create({
      data: { organizerProfileId: orgId, eventId, code: "TESTREF", commissionPct: 15 },
    });

    const req = new NextRequest("http://localhost/api/public/affiliate/TESTREF");
    const res = await trackAffiliate(req, { params: Promise.resolve({ code: "TESTREF" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.eventSlug).toBe("test-event");

    const updated = await prisma.affiliateLink.findUnique({ where: { id: link.id } });
    expect(updated?.clickCount).toBe(1);
  }, 30000);

  it("POST /api/checkout with valid affiliateCode sets affiliateLinkId", async () => {
    const link = await prisma.affiliateLink.create({
      data: { organizerProfileId: orgId, code: "VALIDREF" },
    });

    const req = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        eventId,
        buyerName: "Bob",
        buyerEmail: "bob@test.com",
        affiliateCode: "VALIDREF",
        items: [{ ticketTypeId, quantity: 1 }],
      }),
    });

    const res = await checkout(req);
    const payload = await res.json();

    expect(res.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { id: payload.data.orderId } });
    expect(order?.affiliateLinkId).toBe(link.id);
  }, 30000);

  it("POST /api/checkout with invalid affiliateCode creates order anyway with null affiliateLinkId", async () => {
    const req = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        eventId,
        buyerName: "Bob",
        buyerEmail: "bob@test.com",
        affiliateCode: "INVALIDCODE",
        items: [{ ticketTypeId, quantity: 1 }],
      }),
    });

    const res = await checkout(req);
    const payload = await res.json();

    expect(res.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { id: payload.data.orderId } });
    expect(order?.affiliateLinkId).toBeNull();
  }, 30000);

  it("DELETE /api/organizer/affiliate/[id] sets isActive = false, does not delete", async () => {
    const link = await prisma.affiliateLink.create({
      data: { organizerProfileId: orgId, code: "TODELETE" },
    });

    const req = new NextRequest(`http://localhost/api/organizer/affiliate/${link.id}`, { method: "DELETE" });
    const res = await deleteAffiliate(req, { params: Promise.resolve({ id: link.id }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.deleted).toBe(true);

    const updated = await prisma.affiliateLink.findUnique({ where: { id: link.id } });
    expect(updated?.isActive).toBe(false);
  }, 30000);
});