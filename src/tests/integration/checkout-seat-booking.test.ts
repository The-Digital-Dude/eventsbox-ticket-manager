import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

const {
  eventFindFirstMock,
  organizerPayoutSettingsFindUniqueMock,
  txEventFindFirstMock,
  txEventSeatBookingDeleteManyMock,
  txEventSeatBookingFindManyMock,
  txEventSeatBookingCreateMock,
  orderCreateMock,
  orderUpdateMock,
  getStripeClientMock,
  getServerSessionMock,
  prismaTransactionMock,
} = vi.hoisted(() => ({
  eventFindFirstMock: vi.fn(),
  organizerPayoutSettingsFindUniqueMock: vi.fn(),
  txEventFindFirstMock: vi.fn(),
  txEventSeatBookingDeleteManyMock: vi.fn(),
  txEventSeatBookingFindManyMock: vi.fn(),
  txEventSeatBookingCreateMock: vi.fn(),
  orderCreateMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  getStripeClientMock: vi.fn(),
  getServerSessionMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
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
      findUnique: vi.fn(),
    },
    order: {
      update: orderUpdateMock,
      delete: vi.fn(),
    },
    eventSeatBooking: {
      deleteMany: vi.fn(),
    },
    $transaction: prismaTransactionMock,
  },
}));

vi.mock("@/src/lib/stripe/client", () => ({
  getStripeClient: getStripeClientMock,
}));

vi.mock("@/src/lib/auth/server-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/src/lib/services/promo-code", () => ({
  validatePromoCodeById: vi.fn(),
}));

import { POST } from "@/app/api/checkout/route";

const seatedEvent = {
  id: "event-1",
  organizerProfileId: "organizer-profile-1",
  status: "PUBLISHED",
  commissionPct: new Prisma.Decimal(10),
  gstPct: new Prisma.Decimal(15),
  platformFeeFixed: new Prisma.Decimal(0),
  venue: {
    name: "Grand Hall",
  },
  seatingPlan: {
    sections: [
      {
        id: "main",
        key: "main",
        name: "Main",
        sectionType: "ROWS",
        capacity: 2,
      },
    ],
  },
  ticketTypes: [
    {
      id: "ticket-1",
      sourceSeatingSectionId: "main",
      classType: "ASSIGNED_SEAT",
      isActive: true,
      sold: 0,
      reservedQty: 0,
      quantity: 100,
      maxPerOrder: 10,
      price: new Prisma.Decimal(25),
      name: "General",
    },
  ],
};

describe("checkout seat booking integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    eventFindFirstMock.mockResolvedValue(seatedEvent);
    organizerPayoutSettingsFindUniqueMock.mockResolvedValue(null);
    txEventFindFirstMock.mockResolvedValue(seatedEvent);
    txEventSeatBookingDeleteManyMock.mockResolvedValue({ count: 0 });
    txEventSeatBookingFindManyMock.mockResolvedValue([]);
    txEventSeatBookingCreateMock.mockResolvedValue({});
    orderCreateMock.mockResolvedValue({
      id: "order-1",
      subtotal: new Prisma.Decimal(50),
      discountAmount: new Prisma.Decimal(0),
      platformFee: new Prisma.Decimal(5),
      gst: new Prisma.Decimal(8.25),
      total: new Prisma.Decimal(63.25),
      items: [{ id: "item-1", ticketTypeId: "ticket-1", quantity: 2 }],
    });
    orderUpdateMock.mockResolvedValue({});
    getServerSessionMock.mockResolvedValue(null);
    getStripeClientMock.mockReturnValue({
      paymentIntents: {
        create: vi.fn().mockResolvedValue({ id: "pi_123", client_secret: "cs_test_123" }),
      },
    });

    prismaTransactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        event: { findFirst: txEventFindFirstMock },
        eventSeatBooking: {
          deleteMany: txEventSeatBookingDeleteManyMock,
          findMany: txEventSeatBookingFindManyMock,
          create: txEventSeatBookingCreateMock,
        },
        order: { create: orderCreateMock },
        promoCode: { update: vi.fn() },
      }),
    );
  });

  it("requires seat selection for events with seating", async () => {
    const req = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        eventId: "event-1",
        buyerName: "Seat Buyer",
        buyerEmail: "seat@example.com",
        items: [{ ticketTypeId: "ticket-1", quantity: 2 }],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("SEAT_SELECTION_REQUIRED");
    expect(orderCreateMock).not.toHaveBeenCalled();
  });

  it("rejects unavailable seats before creating an order", async () => {
    txEventSeatBookingFindManyMock.mockResolvedValue([
      { seatId: "Main-A1" },
    ]);

    const req = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        eventId: "event-1",
        buyerName: "Seat Buyer",
        buyerEmail: "seat@example.com",
        items: [{ ticketTypeId: "ticket-1", quantity: 2 }],
        selectedSeatIds: ["Main-A1", "Main-A2"],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.error.code).toBe("SEAT_ALREADY_RESERVED");
    expect(orderCreateMock).not.toHaveBeenCalled();
  });

  it("creates reserved seat bookings during checkout", async () => {
    const req = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        eventId: "event-1",
        buyerName: "Seat Buyer",
        buyerEmail: "seat@example.com",
        items: [{ ticketTypeId: "ticket-1", quantity: 2 }],
        selectedSeatIds: ["Main-A1", "Main-A2"],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.orderId).toBe("order-1");
    expect(payload.data.seatHoldExpiresAt).toEqual(expect.any(String));
    expect(txEventSeatBookingCreateMock).toHaveBeenCalledTimes(2);
    expect(txEventSeatBookingCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "order-1",
          seatId: "Main-A1",
          seatLabel: "Main A1",
          status: "RESERVED",
          expiresAt: expect.any(Date),
        }),
      }),
    );
  });
});
