import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { POST } from "@/app/api/organizer/uploads/logo/route";
import { GET } from "@/app/api/account/tickets/[ticketId]/pdf/route";

const {
  requireRoleMock,
  requireAttendeeMock,
  uploadImageMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  requireAttendeeMock: vi.fn(),
  uploadImageMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
  requireAuth: vi.fn(),
  requireApprovedOrganizer: vi.fn(),
}));

vi.mock("@/src/lib/auth/require-attendee", () => ({
  requireAttendee: requireAttendeeMock,
}));

vi.mock("@/src/lib/services/event-image-upload", () => ({
  uploadEventImage: uploadImageMock,
  EventImageUploadError: class EventImageUploadError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status = 400) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

describe("Organizer Logo & PDF Ticket Integration", () => {
  let orgId: string;
  let userId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.ticketTransfer.deleteMany();
    await prisma.eventSeatBooking.deleteMany();
    await prisma.qRTicket.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.ticketType.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organizerProfile.deleteMany();
    await prisma.attendeeProfile.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: "org@test.com",
        passwordHash: "hash",
        role: "ORGANIZER",
      },
    });
    userId = user.id;

    const profile = await prisma.organizerProfile.create({
      data: {
        userId: user.id,
        companyName: "Test Org",
        approvalStatus: "APPROVED",
      },
    });
    orgId = profile.id;
  }, 30000);

  it("POST /api/organizer/uploads/logo updates profile and returns logoUrl", async () => {
    requireRoleMock.mockResolvedValue({ sub: userId, role: "ORGANIZER" });
    uploadImageMock.mockResolvedValue({ url: "https://cloudinary.com/logo.png" });

    const form = new FormData();
    form.append("file", new File(["abc"], "logo.png", { type: "image/png" }));
    const req = new NextRequest("http://localhost/api/organizer/uploads/logo", {
      method: "POST",
      body: form,
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.logoUrl).toBe("https://cloudinary.com/logo.png");

    const updated = await prisma.organizerProfile.findUnique({ where: { userId } });
    expect(updated?.logoUrl).toBe("https://cloudinary.com/logo.png");
  }, 30000);

  it("PDF route includes logo bytes when logoUrl is set", async () => {
    // Setup event, ticket, order
    const event = await prisma.event.create({
      data: {
        organizerProfileId: orgId,
        title: "Test Event",
        slug: "test-event",
        startAt: new Date(),
        endAt: new Date(),
      },
    });

    const ticketType = await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: "General",
        price: 10,
        quantity: 100,
      },
    });

    const attendeeUser = await prisma.user.create({
      data: { email: "att@test.com", passwordHash: "h", role: "ATTENDEE" },
    });
    const attendeeProfile = await prisma.attendeeProfile.create({
      data: { userId: attendeeUser.id },
    });

    const order = await prisma.order.create({
      data: {
        eventId: event.id,
        attendeeUserId: attendeeProfile.id,
        buyerEmail: "att@test.com",
        buyerName: "Att",
        subtotal: 10,
        platformFee: 1,
        gst: 1.5,
        total: 12.5,
        status: "PAID",
      },
    });

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        ticketTypeId: ticketType.id,
        quantity: 1,
        unitPrice: 10,
        subtotal: 10,
      },
    });

    const ticket = await prisma.qRTicket.create({
      data: {
        orderId: order.id,
        orderItemId: orderItem.id,
        ticketNumber: "T-123",
      },
    });

    // Set logo URL
    await prisma.organizerProfile.update({
      where: { id: orgId },
      data: { logoUrl: "https://cloudinary.com/logo.png" },
    });

    requireAttendeeMock.mockResolvedValue({ user: { id: attendeeUser.id } });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64"),
    } as unknown as Response);

    const req = new NextRequest(`http://localhost/api/account/tickets/${ticket.id}/pdf`);
    const res = await GET(req, { params: Promise.resolve({ ticketId: ticket.id }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(global.fetch).toHaveBeenCalledWith("https://cloudinary.com/logo.png");
  }, 30000);
});
