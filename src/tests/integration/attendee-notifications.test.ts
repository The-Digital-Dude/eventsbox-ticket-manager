import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAttendeeMock,
  notificationFindManyMock,
  notificationCountMock,
  notificationUpdateManyMock,
  notificationFindFirstMock,
  notificationUpdateMock,
  getStripeClientMock,
  stripeWebhookFindUniqueMock,
  stripeWebhookUpsertMock,
  stripeWebhookUpdateMock,
  stripeWebhookUpdateManyMock,
  orderFindFirstMock,
  orderFindUniqueMock,
  orderUpdateManyMock,
  attendeeProfileFindUniqueMock,
  transactionMock,
  transactionOrderUpdateMock,
  transactionTicketTypeUpdateMock,
  transactionQRTicketCreateMock,
  sendOrderConfirmationEmailMock,
  notifyWaitlistMock,
  createNotificationMock,
} = vi.hoisted(() => ({
  requireAttendeeMock: vi.fn(),
  notificationFindManyMock: vi.fn(),
  notificationCountMock: vi.fn(),
  notificationUpdateManyMock: vi.fn(),
  notificationFindFirstMock: vi.fn(),
  notificationUpdateMock: vi.fn(),
  getStripeClientMock: vi.fn(),
  stripeWebhookFindUniqueMock: vi.fn(),
  stripeWebhookUpsertMock: vi.fn(),
  stripeWebhookUpdateMock: vi.fn(),
  stripeWebhookUpdateManyMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  orderFindUniqueMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  attendeeProfileFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  transactionOrderUpdateMock: vi.fn(),
  transactionTicketTypeUpdateMock: vi.fn(),
  transactionQRTicketCreateMock: vi.fn(),
  sendOrderConfirmationEmailMock: vi.fn(),
  notifyWaitlistMock: vi.fn(),
  createNotificationMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/require-attendee", () => ({
  requireAttendee: requireAttendeeMock,
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

vi.mock("@/src/lib/services/notify", () => ({
  createNotification: createNotificationMock,
}));

vi.mock("@/src/lib/env", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_CONNECT_WEBHOOK_SECRET: undefined,
    APP_URL: "http://localhost:3000",
  },
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    notification: {
      findMany: notificationFindManyMock,
      count: notificationCountMock,
      updateMany: notificationUpdateManyMock,
      findFirst: notificationFindFirstMock,
      update: notificationUpdateMock,
    },
    attendeeProfile: {
      findUnique: attendeeProfileFindUniqueMock,
    },
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

import { GET as notificationsGet } from "@/app/api/account/notifications/route";
import { PATCH as notificationsReadPatch } from "@/app/api/account/notifications/read/route";
import { PATCH as notificationPatch } from "@/app/api/account/notifications/[id]/route";
import { POST as webhookPost } from "@/app/api/webhooks/stripe/route";

describe("attendee notifications integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAttendeeMock.mockResolvedValue({ user: { id: "user-1", role: "ATTENDEE" } });
    attendeeProfileFindUniqueMock.mockResolvedValue({ id: "attendee-profile-1", userId: "user-1" });
    notificationFindManyMock.mockResolvedValue([
      {
        id: "notification-1",
        type: "ORDER_CONFIRMED",
        title: "Booking confirmed!",
        body: "Your tickets are ready.",
        actionUrl: "/account/tickets",
        isRead: false,
        createdAt: new Date("2026-03-19T08:00:00.000Z"),
      },
    ]);
    notificationCountMock.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    notificationUpdateManyMock.mockResolvedValue({ count: 2 });
    notificationFindFirstMock.mockResolvedValue({
      id: "notification-1",
      userId: "user-1",
    });
    notificationUpdateMock.mockResolvedValue({
      id: "notification-1",
      type: "ORDER_CONFIRMED",
      title: "Booking confirmed!",
      body: "Your tickets are ready.",
      actionUrl: "/account/tickets",
      isRead: true,
      createdAt: new Date("2026-03-19T08:00:00.000Z"),
    });

    getStripeClientMock.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockReturnValue({
          id: "evt_test_1",
          type: "payment_intent.succeeded",
          livemode: false,
          data: { object: { id: "pi_test_1" } },
        }),
      },
    });

    stripeWebhookFindUniqueMock.mockResolvedValue(null);
    stripeWebhookUpsertMock.mockResolvedValue(undefined);
    stripeWebhookUpdateMock.mockResolvedValue(undefined);
    stripeWebhookUpdateManyMock.mockResolvedValue(undefined);

    orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      attendeeUserId: "attendee-profile-1",
      buyerEmail: "buyer@example.com",
      buyerName: "Buyer Example",
      event: {
        title: "City Fest",
        startAt: new Date("2026-04-10T18:30:00.000Z"),
        timezone: "Pacific/Auckland",
        customConfirmationMessage: "See you there!",
        venue: { name: "Town Hall" },
      },
      items: [
        {
          id: "item-1",
          ticketTypeId: "ticket-type-1",
          quantity: 1,
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
        customConfirmationMessage: "See you there!",
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
      ],
    });

    transactionOrderUpdateMock.mockResolvedValue(undefined);
    transactionTicketTypeUpdateMock.mockResolvedValue(undefined);
    transactionQRTicketCreateMock.mockResolvedValue(undefined);
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        order: { update: transactionOrderUpdateMock },
        ticketType: { update: transactionTicketTypeUpdateMock },
        qRTicket: { create: transactionQRTicketCreateMock },
        eventSeatBooking: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }),
    );

    sendOrderConfirmationEmailMock.mockResolvedValue({ sent: true, skipped: false });
    notifyWaitlistMock.mockResolvedValue(undefined);
    createNotificationMock.mockResolvedValue(undefined);
    orderUpdateManyMock.mockResolvedValue({ count: 0 });
  });

  it("returns notifications for the logged-in attendee only", async () => {
    const res = await notificationsGet(
      new NextRequest("http://localhost/api/account/notifications?page=1"),
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(notificationFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
      }),
    );
    expect(payload.data.unreadCount).toBe(1);
  });

  it("marks all notifications as read", async () => {
    const res = await notificationsReadPatch(
      new NextRequest("http://localhost/api/account/notifications/read", { method: "PATCH" }),
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(notificationUpdateManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1", isRead: false },
      data: { isRead: true },
    });
    expect(payload.data.updated).toBe(2);
  });

  it("marks a single notification as read", async () => {
    const res = await notificationPatch(
      new NextRequest("http://localhost/api/account/notifications/notification-1", { method: "PATCH" }),
      { params: Promise.resolve({ id: "notification-1" }) },
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(notificationFindFirstMock).toHaveBeenCalledWith({
      where: { id: "notification-1", userId: "user-1" },
    });
    expect(payload.data.isRead).toBe(true);
  });

  it("creates an order-confirmed notification after the payment webhook", async () => {
    const res = await webhookPost(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "stripe-signature": "test_signature" },
      }),
    );

    expect(res.status).toBe(200);
    expect(createNotificationMock).toHaveBeenCalledWith(
      "user-1",
      "ORDER_CONFIRMED",
      "Booking confirmed!",
      "Your tickets for City Fest are ready.",
      "/account/tickets",
    );
  });
});
