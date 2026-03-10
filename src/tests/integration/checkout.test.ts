import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscountType, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

const {
  getStripeClientMock,
  paymentIntentCreateMock,
  validatePromoCodeByIdMock,
  getServerSessionMock,
  eventFindFirstMock,
  organizerPayoutSettingsFindUniqueMock,
  attendeeProfileFindUniqueMock,
  orderUpdateMock,
  orderCreateMock,
  orderFindFirstMock,
  orderFindUniqueMock,
  stripeWebhookFindUniqueMock,
  stripeWebhookUpsertMock,
  stripeWebhookUpdateMock,
  stripeWebhookUpdateManyMock,
  prismaTransactionMock,
  txEventFindFirstMock,
  txEventSeatBookingDeleteManyMock,
  txPromoCodeUpdateMock,
  txOrderUpdateMock,
  txTicketTypeUpdateMock,
  txQRTicketCreateMock,
  txEventSeatBookingFindManyMock,
  txEventSeatBookingUpdateManyMock,
  txExecuteRawMock,
  sendOrderConfirmationEmailMock,
  notifyWaitlistMock,
  constructEventMock,
} = vi.hoisted(() => ({
  getStripeClientMock: vi.fn(),
  paymentIntentCreateMock: vi.fn(),
  validatePromoCodeByIdMock: vi.fn(),
  getServerSessionMock: vi.fn(),
  eventFindFirstMock: vi.fn(),
  organizerPayoutSettingsFindUniqueMock: vi.fn(),
  attendeeProfileFindUniqueMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  orderCreateMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  orderFindUniqueMock: vi.fn(),
  stripeWebhookFindUniqueMock: vi.fn(),
  stripeWebhookUpsertMock: vi.fn(),
  stripeWebhookUpdateMock: vi.fn(),
  stripeWebhookUpdateManyMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
  txEventFindFirstMock: vi.fn(),
  txEventSeatBookingDeleteManyMock: vi.fn(),
  txPromoCodeUpdateMock: vi.fn(),
  txOrderUpdateMock: vi.fn(),
  txTicketTypeUpdateMock: vi.fn(),
  txQRTicketCreateMock: vi.fn(),
  txEventSeatBookingFindManyMock: vi.fn(),
  txEventSeatBookingUpdateManyMock: vi.fn(),
  txExecuteRawMock: vi.fn(),
  sendOrderConfirmationEmailMock: vi.fn(),
  notifyWaitlistMock: vi.fn(),
  constructEventMock: vi.fn(),
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

vi.mock("@/src/lib/services/promo-code", () => ({
  validatePromoCodeById: validatePromoCodeByIdMock,
}));

vi.mock("@/src/lib/auth/server-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/src/lib/services/notifications", () => ({
  sendOrderConfirmationEmail: sendOrderConfirmationEmailMock,
}));

vi.mock("@/src/lib/services/waitlist", () => ({
  notifyWaitlist: notifyWaitlistMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      findFirst: eventFindFirstMock,
    },
    organizerPayoutSettings: {
      findUnique: organizerPayoutSettingsFindUniqueMock,
    },
    attendeeProfile: {
      findUnique: attendeeProfileFindUniqueMock,
    },
    order: {
      create: orderCreateMock,
      update: orderUpdateMock,
      findFirst: orderFindFirstMock,
      findUnique: orderFindUniqueMock,
      updateMany: vi.fn(),
    },
    stripeWebhookEvent: {
      findUnique: stripeWebhookFindUniqueMock,
      upsert: stripeWebhookUpsertMock,
      update: stripeWebhookUpdateMock,
      updateMany: stripeWebhookUpdateManyMock,
    },
    $transaction: prismaTransactionMock,
  },
}));

import { POST as checkoutPost } from "@/app/api/checkout/route";
import { POST as webhookPost } from "@/app/api/webhooks/stripe/route";

const publishedEvent = {
  id: "event-1",
  organizerProfileId: "organizer-profile-1",
  status: "PUBLISHED",
  commissionPct: new Prisma.Decimal(10),
  gstPct: new Prisma.Decimal(15),
  platformFeeFixed: new Prisma.Decimal(0),
  venue: null,
  ticketTypes: [
    {
      id: "ticket-1",
      isActive: true,
      sold: 0,
      quantity: 100,
      maxPerOrder: 10,
      price: new Prisma.Decimal(50),
      name: "General",
    },
  ],
};

type PromoCodeState = {
  id: string;
  maxUses: number | null;
  usedCount: number;
};

let promoCodeState: PromoCodeState;
let stripeEvents: Array<{
  id: string;
  type: "payment_intent.succeeded";
  livemode: false;
  data: { object: { id: string } };
}>;

function queueCheckoutTransaction() {
  prismaTransactionMock.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      event: { findFirst: txEventFindFirstMock },
      eventSeatBooking: { deleteMany: txEventSeatBookingDeleteManyMock },
      order: { create: orderCreateMock },
      promoCode: { update: txPromoCodeUpdateMock },
    }),
  );
}

function queueWebhookTransaction() {
  prismaTransactionMock.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      order: { update: txOrderUpdateMock },
      ticketType: { update: txTicketTypeUpdateMock },
      qRTicket: { create: txQRTicketCreateMock },
      eventSeatBooking: {
        findMany: txEventSeatBookingFindManyMock,
        updateMany: txEventSeatBookingUpdateManyMock,
      },
      $executeRaw: txExecuteRawMock,
    }),
  );
}

function createCheckoutRequest(promoCodeId = promoCodeState.id) {
  return new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    body: JSON.stringify({
      eventId: publishedEvent.id,
      buyerName: "Promo Buyer",
      buyerEmail: "buyer@example.com",
      promoCodeId,
      items: [{ ticketTypeId: "ticket-1", quantity: 2 }],
    }),
    headers: { "content-type": "application/json" },
  });
}

function createWebhookRequest() {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "stripe-signature": "test_signature" },
  });
}

describe("checkout promo lifecycle integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    promoCodeState = {
      id: "ckpromo000000000000000001",
      maxUses: 1,
      usedCount: 0,
    };
    stripeEvents = [];

    eventFindFirstMock.mockResolvedValue(publishedEvent);
    organizerPayoutSettingsFindUniqueMock.mockResolvedValue(null);
    txEventFindFirstMock.mockResolvedValue(publishedEvent);
    txEventSeatBookingDeleteManyMock.mockResolvedValue({ count: 0 });
    attendeeProfileFindUniqueMock.mockResolvedValue({ id: "attendee-profile-1" });
    getServerSessionMock.mockResolvedValue(null);
    orderUpdateMock.mockResolvedValue({});
    orderCreateMock.mockResolvedValue({
      id: "order-1",
      subtotal: new Prisma.Decimal(100),
      discountAmount: new Prisma.Decimal(10),
      platformFee: new Prisma.Decimal(10),
      gst: new Prisma.Decimal(16.5),
      total: new Prisma.Decimal(116.5),
      items: [{ id: "item-1", ticketTypeId: "ticket-1", quantity: 2 }],
    });

    validatePromoCodeByIdMock.mockImplementation(async () => ({
      valid: true,
      promoCode: {
        id: promoCodeState.id,
        discountType: DiscountType.PERCENTAGE,
        discountValue: new Prisma.Decimal(10),
      },
    }));

    stripeWebhookFindUniqueMock.mockResolvedValue(null);
    stripeWebhookUpsertMock.mockResolvedValue(undefined);
    stripeWebhookUpdateMock.mockResolvedValue(undefined);
    stripeWebhookUpdateManyMock.mockResolvedValue(undefined);
    orderFindUniqueMock.mockResolvedValue({
      buyerEmail: "buyer@example.com",
      buyerName: "Promo Buyer",
      event: {
        title: "Launch Night",
        startAt: new Date("2026-04-10T18:30:00.000Z"),
        timezone: "Pacific/Auckland",
        venue: { name: "Town Hall" },
      },
      tickets: [
        {
          id: "qr-1",
          ticketNumber: "ORD-001",
          seatLabel: null,
          orderItem: {
            ticketType: { name: "General" },
          },
        },
      ],
    });

    txPromoCodeUpdateMock.mockImplementation(async () => {
      promoCodeState.usedCount += 1;
      return {};
    });
    txOrderUpdateMock.mockResolvedValue(undefined);
    txTicketTypeUpdateMock.mockResolvedValue(undefined);
    txQRTicketCreateMock.mockResolvedValue(undefined);
    txEventSeatBookingFindManyMock.mockResolvedValue([]);
    txEventSeatBookingUpdateManyMock.mockResolvedValue({ count: 0 });
    txExecuteRawMock.mockImplementation(async (_query: TemplateStringsArray, promoCodeId: string) => {
      if (
        promoCodeId === promoCodeState.id &&
        (promoCodeState.maxUses === null || promoCodeState.usedCount < promoCodeState.maxUses)
      ) {
        promoCodeState.usedCount += 1;
        return 1;
      }

      return 0;
    });

    constructEventMock.mockImplementation(() => {
      const stripeEvent = stripeEvents.shift();
      if (!stripeEvent) {
        throw new Error("Missing mocked Stripe event");
      }

      return stripeEvent;
    });

    paymentIntentCreateMock.mockResolvedValue({ id: "pi_checkout_1", client_secret: "cs_test_123" });

    getStripeClientMock.mockReturnValue({
      paymentIntents: {
        create: paymentIntentCreateMock,
      },
      webhooks: {
        constructEvent: constructEventMock,
      },
    });

    sendOrderConfirmationEmailMock.mockResolvedValue({ sent: true, skipped: false });
    notifyWaitlistMock.mockResolvedValue(undefined);
  });

  it("promo code usedCount stays 0 after abandoned checkout", async () => {
    queueCheckoutTransaction();

    const res = await checkoutPost(createCheckoutRequest());
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.orderId).toBe("order-1");
    expect(orderCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promoCodeId: promoCodeState.id,
          status: "PENDING",
        }),
      }),
    );
    expect(txPromoCodeUpdateMock).not.toHaveBeenCalled();
    expect(promoCodeState.usedCount).toBe(0);
  });

  it("routes checkout payments to a completed Stripe Connect account", async () => {
    organizerPayoutSettingsFindUniqueMock.mockResolvedValueOnce({
      stripeAccountId: "acct_123",
      stripeOnboardingStatus: "COMPLETED",
      payoutMode: "STRIPE_CONNECT",
    });
    queueCheckoutTransaction();

    const res = await checkoutPost(createCheckoutRequest());

    expect(res.status).toBe(200);
    expect(paymentIntentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 11650,
        application_fee_amount: 1000,
        transfer_data: { destination: "acct_123" },
      }),
    );
  });

  it("promo code usedCount increments to 1 after payment_intent.succeeded", async () => {
    queueCheckoutTransaction();

    const checkoutRes = await checkoutPost(createCheckoutRequest());
    expect(checkoutRes.status).toBe(200);
    expect(promoCodeState.usedCount).toBe(0);

    stripeEvents.push({
      id: "evt_checkout_paid_1",
      type: "payment_intent.succeeded",
      livemode: false,
      data: { object: { id: "pi_checkout_1" } },
    });
    orderFindFirstMock.mockResolvedValueOnce({
      id: "order-1",
      promoCodeId: promoCodeState.id,
      buyerEmail: "buyer@example.com",
      buyerName: "Promo Buyer",
      event: {
        title: "Launch Night",
        startAt: new Date("2026-04-10T18:30:00.000Z"),
        timezone: "Pacific/Auckland",
        venue: { name: "Town Hall" },
      },
      items: [
        {
          id: "item-1",
          ticketTypeId: "ticket-1",
          quantity: 1,
          ticketType: { name: "General" },
        },
      ],
    });
    queueWebhookTransaction();

    const webhookRes = await webhookPost(createWebhookRequest());
    const webhookPayload = await webhookRes.json();

    expect(webhookRes.status).toBe(200);
    expect(webhookPayload.data.received).toBe(true);
    expect(txExecuteRawMock).toHaveBeenCalledTimes(1);
    expect(promoCodeState.usedCount).toBe(1);
  });

  it("single-use promo code does not increment past maxUses after a second payment succeeds", async () => {
    stripeEvents.push(
      {
        id: "evt_checkout_paid_1",
        type: "payment_intent.succeeded",
        livemode: false,
        data: { object: { id: "pi_checkout_1" } },
      },
      {
        id: "evt_checkout_paid_2",
        type: "payment_intent.succeeded",
        livemode: false,
        data: { object: { id: "pi_checkout_2" } },
      },
    );

    orderFindFirstMock
      .mockResolvedValueOnce({
        id: "order-1",
        promoCodeId: promoCodeState.id,
        buyerEmail: "buyer@example.com",
        buyerName: "Promo Buyer",
        event: {
          title: "Launch Night",
          startAt: new Date("2026-04-10T18:30:00.000Z"),
          timezone: "Pacific/Auckland",
          venue: { name: "Town Hall" },
        },
        items: [
          {
            id: "item-1",
            ticketTypeId: "ticket-1",
            quantity: 1,
            ticketType: { name: "General" },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "order-2",
        promoCodeId: promoCodeState.id,
        buyerEmail: "buyer@example.com",
        buyerName: "Promo Buyer",
        event: {
          title: "Launch Night",
          startAt: new Date("2026-04-10T18:30:00.000Z"),
          timezone: "Pacific/Auckland",
          venue: { name: "Town Hall" },
        },
        items: [
          {
            id: "item-2",
            ticketTypeId: "ticket-1",
            quantity: 1,
            ticketType: { name: "General" },
          },
        ],
      });

    queueWebhookTransaction();
    queueWebhookTransaction();

    const firstWebhookRes = await webhookPost(createWebhookRequest());
    expect(firstWebhookRes.status).toBe(200);

    const secondWebhookRes = await webhookPost(createWebhookRequest());
    expect(secondWebhookRes.status).toBe(200);

    expect(txExecuteRawMock).toHaveBeenCalledTimes(2);
    expect(promoCodeState.usedCount).toBe(1);
  });
});
