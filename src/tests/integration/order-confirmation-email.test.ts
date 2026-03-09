import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getStripeClientMock,
  stripeWebhookFindUniqueMock,
  stripeWebhookUpsertMock,
  stripeWebhookUpdateMock,
  stripeWebhookUpdateManyMock,
  orderFindFirstMock,
  orderFindUniqueMock,
  orderUpdateManyMock,
  transactionOrderUpdateMock,
  transactionTicketTypeUpdateMock,
  transactionQRTicketCreateManyMock,
  transactionMock,
  sendOrderConfirmationEmailMock,
  notifyWaitlistMock,
} = vi.hoisted(() => ({
  getStripeClientMock: vi.fn(),
  stripeWebhookFindUniqueMock: vi.fn(),
  stripeWebhookUpsertMock: vi.fn(),
  stripeWebhookUpdateMock: vi.fn(),
  stripeWebhookUpdateManyMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  orderFindUniqueMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  transactionOrderUpdateMock: vi.fn(),
  transactionTicketTypeUpdateMock: vi.fn(),
  transactionQRTicketCreateManyMock: vi.fn(),
  transactionMock: vi.fn(),
  sendOrderConfirmationEmailMock: vi.fn(),
  notifyWaitlistMock: vi.fn(),
}));

vi.mock("@/src/lib/env", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_CONNECT_WEBHOOK_SECRET: undefined,
    APP_URL: "http://localhost:3000",
  },
}));

vi.mock("@/src/lib/stripe/client", () => ({
  getStripeClient: getStripeClientMock,
}));

vi.mock("@/src/lib/services/notifications", () => ({
  sendOrderConfirmationEmail: sendOrderConfirmationEmailMock,
}));

vi.mock("@/src/lib/services/waitlist", () => ({
  notifyWaitlist: notifyWaitlistMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    stripeWebhookEvent: {
      findUnique: stripeWebhookFindUniqueMock,
      upsert: stripeWebhookUpsertMock,
      update: stripeWebhookUpdateMock,
      updateMany: stripeWebhookUpdateManyMock,
    },
    order: {
      findFirst: orderFindFirstMock,
      findUnique: orderFindUniqueMock,
      updateMany: orderUpdateManyMock,
    },
    $transaction: transactionMock,
  },
}));

import { POST } from "@/app/api/webhooks/stripe/route";

describe("order confirmation email integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const stripeEvent = {
      id: "evt_test_1",
      type: "payment_intent.succeeded",
      livemode: false,
      data: {
        object: {
          id: "pi_test_1",
        },
      },
    };

    getStripeClientMock.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockReturnValue(stripeEvent),
      },
    });

    stripeWebhookFindUniqueMock.mockResolvedValue(null);
    stripeWebhookUpsertMock.mockResolvedValue(undefined);
    stripeWebhookUpdateMock.mockResolvedValue(undefined);
    stripeWebhookUpdateManyMock.mockResolvedValue(undefined);

    orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      buyerEmail: "buyer@example.com",
      buyerName: "Buyer Example",
      total: 125,
      event: {
        title: "City Fest",
        startAt: new Date("2026-04-10T18:30:00.000Z"),
        timezone: "Pacific/Auckland",
        venue: { name: "Town Hall" },
      },
      items: [
        {
          id: "item-1",
          ticketTypeId: "ticket-type-1",
          quantity: 2,
          ticketType: { name: "General Admission" },
        },
      ],
    });

    orderFindUniqueMock.mockResolvedValue({
      buyerEmail: "buyer@example.com",
      buyerName: "Buyer Example",
      event: {
        title: "City Fest",
        startAt: new Date("2026-04-10T18:30:00.000Z"),
        timezone: "Pacific/Auckland",
        venue: { name: "Town Hall" },
      },
      tickets: [
        {
          id: "qr-1",
          ticketNumber: "ORD-001",
          orderItem: {
            ticketType: { name: "General Admission" },
          },
        },
        {
          id: "qr-2",
          ticketNumber: "ORD-002",
          orderItem: {
            ticketType: { name: "General Admission" },
          },
        },
      ],
    });

    transactionOrderUpdateMock.mockResolvedValue(undefined);
    transactionTicketTypeUpdateMock.mockResolvedValue(undefined);
    transactionQRTicketCreateManyMock.mockResolvedValue({ count: 2 });
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        order: { update: transactionOrderUpdateMock },
        ticketType: { update: transactionTicketTypeUpdateMock },
        qRTicket: { createMany: transactionQRTicketCreateManyMock },
      }),
    );

    sendOrderConfirmationEmailMock.mockResolvedValue({ sent: true, skipped: false });
    notifyWaitlistMock.mockResolvedValue(undefined);
    orderUpdateManyMock.mockResolvedValue({ count: 0 });
  });

  it("sends order confirmation email after successful payment webhook", async () => {
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "stripe-signature": "test_signature",
      },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.received).toBe(true);
    expect(transactionOrderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "PAID", paidAt: expect.any(Date) },
    });
    expect(transactionQRTicketCreateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ orderId: "order-1", orderItemId: "item-1" }),
        ]),
      }),
    );
    expect(sendOrderConfirmationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        orderId: "order-1",
        eventTitle: "City Fest",
        venueName: "Town Hall",
        tickets: [
          { id: "qr-1", ticketNumber: "ORD-001", ticketTypeName: "General Admission" },
          { id: "qr-2", ticketNumber: "ORD-002", ticketTypeName: "General Admission" },
        ],
      }),
    );
  });
});
