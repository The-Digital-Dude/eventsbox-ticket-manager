import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const {
  requireRoleMock,
  getStripeClientMock,
  getServerSessionMock,
  organizerProfileFindUniqueMock,
  eventFindFirstMock,
  organizerPayoutSettingsFindUniqueMock,
  sendComplimentaryTicketEmailMock,
  prismaTransactionMock,
  txTicketTypeFindFirstMock,
  txTicketTypeUpdateMock,
  txOrderCreateMock,
  txOrderItemCreateMock,
  txQRTicketCreateMock,
  txCompTicketIssuanceCreateMock,
  txEventSeatBookingDeleteManyMock,
  txEventFindFirstMock,
  checkoutOrderCreateMock,
  paymentIntentCreateMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  getStripeClientMock: vi.fn(),
  getServerSessionMock: vi.fn(),
  organizerProfileFindUniqueMock: vi.fn(),
  eventFindFirstMock: vi.fn(),
  organizerPayoutSettingsFindUniqueMock: vi.fn(),
  sendComplimentaryTicketEmailMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
  txTicketTypeFindFirstMock: vi.fn(),
  txTicketTypeUpdateMock: vi.fn(),
  txOrderCreateMock: vi.fn(),
  txOrderItemCreateMock: vi.fn(),
  txQRTicketCreateMock: vi.fn(),
  txCompTicketIssuanceCreateMock: vi.fn(),
  txEventSeatBookingDeleteManyMock: vi.fn(),
  txEventFindFirstMock: vi.fn(),
  checkoutOrderCreateMock: vi.fn(),
  paymentIntentCreateMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/auth/server-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/src/lib/services/notifications", () => ({
  sendComplimentaryTicketEmail: sendComplimentaryTicketEmailMock,
}));

vi.mock("@/src/lib/stripe/client", () => ({
  getStripeClient: getStripeClientMock,
}));

vi.mock("@/src/lib/services/promo-code", () => ({
  validatePromoCodeById: vi.fn(),
}));

vi.mock("@/src/lib/env", () => ({
  env: {
    APP_URL: "http://localhost:3000",
  },
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: {
      findUnique: organizerProfileFindUniqueMock,
    },
    event: {
      findFirst: eventFindFirstMock,
    },
    organizerPayoutSettings: {
      findUnique: organizerPayoutSettingsFindUniqueMock,
    },
    $transaction: prismaTransactionMock,
    order: {
      update: vi.fn(),
    },
  },
}));

import { POST as compTicketsPost } from "@/app/api/organizer/events/[id]/comp-tickets/route";
import { POST as checkoutPost } from "@/app/api/checkout/route";

const ticketTypeId = "ckticket000000000000000001";

const organizerEvent = {
  id: "event-1",
  title: "VIP Launch",
  status: "PUBLISHED",
  startAt: new Date("2026-06-20T18:00:00.000Z"),
  timezone: "UTC",
  venue: { name: "Town Hall" },
  ticketTypes: [
    {
      id: ticketTypeId,
      name: "General",
      quantity: 10,
      sold: 2,
      reservedQty: 5,
      compIssued: 0,
      price: new Prisma.Decimal(50),
      isActive: true,
    },
  ],
};

const checkoutEvent = {
  id: "event-1",
  organizerProfileId: "org-profile-1",
  status: "PUBLISHED",
  commissionPct: new Prisma.Decimal(10),
  gstPct: new Prisma.Decimal(15),
  platformFeeFixed: new Prisma.Decimal(0),
  venue: null,
  ticketTypes: [
    {
      id: ticketTypeId,
      name: "General",
      quantity: 10,
      sold: 2,
      reservedQty: 3,
      maxPerOrder: 10,
      price: new Prisma.Decimal(50),
      isActive: true,
    },
  ],
};

function queueCompTransaction() {
  prismaTransactionMock.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      ticketType: {
        findFirst: txTicketTypeFindFirstMock,
        update: txTicketTypeUpdateMock,
      },
      order: {
        create: txOrderCreateMock,
      },
      orderItem: {
        create: txOrderItemCreateMock,
      },
      qRTicket: {
        create: txQRTicketCreateMock,
      },
      compTicketIssuance: {
        create: txCompTicketIssuanceCreateMock,
      },
    }),
  );
}

function queueCheckoutTransaction() {
  prismaTransactionMock.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      eventSeatBooking: {
        deleteMany: txEventSeatBookingDeleteManyMock,
      },
      event: {
        findFirst: txEventFindFirstMock,
      },
      order: {
        create: checkoutOrderCreateMock,
      },
    }),
  );
}

describe("complimentary tickets integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "organizer-user-1", role: "ORGANIZER" });
    getServerSessionMock.mockResolvedValue(null);
    organizerProfileFindUniqueMock.mockResolvedValue({ id: "org-profile-1" });
    organizerPayoutSettingsFindUniqueMock.mockResolvedValue(null);
    sendComplimentaryTicketEmailMock.mockResolvedValue({ sent: true, skipped: false });
    getStripeClientMock.mockReturnValue({
      paymentIntents: {
        create: paymentIntentCreateMock,
      },
    });
    paymentIntentCreateMock.mockResolvedValue({ id: "pi_test_1", client_secret: "cs_test_123" });

    txTicketTypeFindFirstMock.mockResolvedValue({
      id: ticketTypeId,
      name: "General",
      price: new Prisma.Decimal(50),
      reservedQty: 5,
      compIssued: 0,
    });
    txOrderCreateMock.mockResolvedValue({ id: "order-1" });
    txOrderItemCreateMock.mockResolvedValue({ id: "item-1" });
    txQRTicketCreateMock.mockResolvedValue({ id: "qr-1", ticketNumber: "ORDER1-GEN-001" });
    txCompTicketIssuanceCreateMock.mockResolvedValue({
      id: "issuance-1",
      recipientName: "Guest User",
      recipientEmail: "guest@example.com",
      note: null,
      createdAt: new Date("2026-05-01T00:00:00.000Z").toISOString(),
      ticketType: { id: "ticket-1", name: "General" },
      qrTicket: { id: "qr-1", ticketNumber: "ORDER1-GEN-001" },
    });
    txTicketTypeUpdateMock.mockResolvedValue(undefined);
    txEventSeatBookingDeleteManyMock.mockResolvedValue({ count: 0 });
    txEventFindFirstMock.mockResolvedValue(checkoutEvent);
    checkoutOrderCreateMock.mockResolvedValue({
      id: "order-checkout-1",
      subtotal: new Prisma.Decimal(50),
      discountAmount: new Prisma.Decimal(0),
      platformFee: new Prisma.Decimal(5),
      gst: new Prisma.Decimal(8.25),
      total: new Prisma.Decimal(63.25),
      items: [{ id: "item-1", ticketTypeId: "ticket-1", quantity: 1 }],
    });
  });

  it("issues a complimentary ticket and creates a scannable QR ticket", async () => {
    eventFindFirstMock.mockResolvedValue(organizerEvent);
    queueCompTransaction();

    const req = new NextRequest("http://localhost/api/organizer/events/event-1/comp-tickets", {
      method: "POST",
      body: JSON.stringify({
        ticketTypeId,
        recipientName: "Guest User",
        recipientEmail: "guest@example.com",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await compTicketsPost(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.issuance.qrTicket.ticketNumber).toBe("ORDER1-GEN-001");
    expect(txQRTicketCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isComplimentary: true,
        }),
      }),
    );
  });

  it("returns NO_COMP_SLOTS when the reserved quota is exhausted", async () => {
    eventFindFirstMock.mockResolvedValue({
      ...organizerEvent,
      ticketTypes: [
        {
          ...organizerEvent.ticketTypes[0],
          compIssued: 5,
        },
      ],
    });

    const req = new NextRequest("http://localhost/api/organizer/events/event-1/comp-tickets", {
      method: "POST",
      body: JSON.stringify({
        ticketTypeId,
        recipientName: "Guest User",
        recipientEmail: "guest@example.com",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await compTicketsPost(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("NO_COMP_SLOTS");
    expect(txQRTicketCreateMock).not.toHaveBeenCalled();
  });

  it("reduces checkout inventory by reserved quantity", async () => {
    eventFindFirstMock.mockResolvedValue(checkoutEvent);
    queueCheckoutTransaction();

    const req = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        eventId: "event-1",
        buyerName: "Buyer",
        buyerEmail: "buyer@example.com",
        items: [{ ticketTypeId, quantity: 6 }],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await checkoutPost(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("INSUFFICIENT_INVENTORY");
    expect(checkoutOrderCreateMock).not.toHaveBeenCalled();
  });
});
