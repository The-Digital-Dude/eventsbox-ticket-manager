import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { POST as createAddOn } from "@/app/api/organizer/events/[id]/addons/route";
import { PATCH as updateAddOn } from "@/app/api/organizer/events/[id]/addons/[addOnId]/route";
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

describe("addons integration", () => {
  let eventId: string;
  let ticketTypeId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    await prisma.eventSeatBooking.deleteMany();
    await prisma.qRTicket.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.orderAddOn.deleteMany();
    await prisma.order.deleteMany();
    await prisma.eventAddOn.deleteMany();
    await prisma.ticketType.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organizerProfile.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { email: "org@test.com", passwordHash: "h", role: "ORGANIZER" },
    });

    const org = await prisma.organizerProfile.create({
      data: { userId: user.id, companyName: "Test Org" },
    });

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

  it("POST /api/organizer/events/[id]/addons creates add-on", async () => {
    const req = new NextRequest(`http://localhost/api/organizer/events/${eventId}/addons`, {
      method: "POST",
      body: JSON.stringify({ name: "VIP Parking", price: 20 }),
    });

    const res = await createAddOn(req, { params: Promise.resolve({ id: eventId }) });
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.data.name).toBe("VIP Parking");
    expect(payload.data.price).toBe("20");

    const row = await prisma.eventAddOn.findUnique({ where: { id: payload.data.id } });
    expect(row).toBeDefined();
  }, 30000);

  it("PATCH /api/organizer/events/[id]/addons/[addOnId] updates add-on", async () => {
    const addOn = await prisma.eventAddOn.create({
      data: { eventId, name: "Parking", price: 15 },
    });

    const req = new NextRequest(`http://localhost/api/organizer/events/${eventId}/addons/${addOn.id}`, {
      method: "PATCH",
      body: JSON.stringify({ price: 25 }),
    });

    const res = await updateAddOn(req, { params: Promise.resolve({ id: eventId, addOnId: addOn.id }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.price).toBe("25");

    const row = await prisma.eventAddOn.findUnique({ where: { id: addOn.id } });
    expect(row?.price.toString()).toBe("25");
  }, 30000);

  it("Checkout creates OrderAddOn and calculates total correctly", async () => {
    const addOn = await prisma.eventAddOn.create({
      data: { eventId, name: "Parking", price: 20 },
    });

    const req = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        eventId,
        buyerName: "Bob",
        buyerEmail: "bob@test.com",
        items: [{ ticketTypeId, quantity: 1 }],
        addOns: [{ addOnId: addOn.id, quantity: 1 }],
      }),
    });

    const res = await checkout(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.summary.subtotal).toBe(30); // 10 ticket + 20 addon

    const orderAddOn = await prisma.orderAddOn.findFirst({
      where: { orderId: payload.data.orderId },
    });
    expect(orderAddOn).toBeDefined();
    expect(orderAddOn?.quantity).toBe(1);
    expect(orderAddOn?.subtotal.toString()).toBe("20");
  }, 30000);

  it("Checkout fails if addOn quantity exceeds maxPerOrder", async () => {
    const addOn = await prisma.eventAddOn.create({
      data: { eventId, name: "Parking", price: 20, maxPerOrder: 2 },
    });

    const req = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        eventId,
        buyerName: "Bob",
        buyerEmail: "bob@test.com",
        items: [{ ticketTypeId, quantity: 1 }],
        addOns: [{ addOnId: addOn.id, quantity: 3 }],
      }),
    });

    const res = await checkout(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("EXCEEDS_MAX_ADDON");
  }, 30000);
});
