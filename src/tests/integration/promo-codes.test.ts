import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscountType, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

const {
  requireRoleMock,
  getServerSessionMock,
  organizerProfileFindUniqueMock,
  eventFindFirstMock,
  promoCodeFindUniqueMock,
  promoCodeCreateMock,
  promoCodeUpdateMock,
  validatePromoCodeByCodeMock,
  validatePromoCodeByIdMock,
  getStripeClientMock,
  orderUpdateMock,
  attendeeProfileFindUniqueMock,
  orderCreateMock,
  txEventFindFirstMock,
  txEventSeatBookingDeleteManyMock,
  txPromoCodeUpdateMock,
  prismaTransactionMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  getServerSessionMock: vi.fn(),
  organizerProfileFindUniqueMock: vi.fn(),
  eventFindFirstMock: vi.fn(),
  promoCodeFindUniqueMock: vi.fn(),
  promoCodeCreateMock: vi.fn(),
  promoCodeUpdateMock: vi.fn(),
  validatePromoCodeByCodeMock: vi.fn(),
  validatePromoCodeByIdMock: vi.fn(),
  getStripeClientMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  attendeeProfileFindUniqueMock: vi.fn(),
  orderCreateMock: vi.fn(),
  txEventFindFirstMock: vi.fn(),
  txEventSeatBookingDeleteManyMock: vi.fn(),
  txPromoCodeUpdateMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/server-auth", () => ({
  requireRole: requireRoleMock,
  getServerSession: getServerSessionMock,
}));

vi.mock("@/src/lib/services/promo-code", () => ({
  validatePromoCodeByCode: validatePromoCodeByCodeMock,
  validatePromoCodeById: validatePromoCodeByIdMock,
}));

vi.mock("@/src/lib/stripe/client", () => ({
  getStripeClient: getStripeClientMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    organizerProfile: {
      findUnique: organizerProfileFindUniqueMock,
    },
    event: {
      findFirst: eventFindFirstMock,
    },
    promoCode: {
      findUnique: promoCodeFindUniqueMock,
      create: promoCodeCreateMock,
      update: promoCodeUpdateMock,
    },
    order: {
      update: orderUpdateMock,
    },
    attendeeProfile: {
      findUnique: attendeeProfileFindUniqueMock,
    },
    $transaction: prismaTransactionMock,
  },
}));

import { POST as organizerPromoCreatePost } from "@/app/api/organizer/promo-codes/route";
import { POST as validatePromoPost } from "@/app/api/checkout/validate-promo/route";
import { POST as checkoutPost } from "@/app/api/checkout/route";

describe("promo codes integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "organizer-user-1", role: "ORGANIZER" });
    organizerProfileFindUniqueMock.mockResolvedValue({ id: "organizer-profile-1" });
    eventFindFirstMock.mockResolvedValue(null);
    promoCodeFindUniqueMock.mockResolvedValue(null);
    promoCodeCreateMock.mockResolvedValue({
      id: "promo-1",
      code: "SAVE10",
      discountType: "PERCENTAGE",
      discountValue: new Prisma.Decimal(10),
      maxUses: 100,
      usedCount: 0,
      expiresAt: null,
      isActive: true,
      eventId: null,
    });

    validatePromoCodeByCodeMock.mockResolvedValue({
      valid: true,
      promoCode: {
        id: "ckpromo000000000000000001",
        discountType: DiscountType.PERCENTAGE,
        discountValue: new Prisma.Decimal(10),
      },
    });

    validatePromoCodeByIdMock.mockResolvedValue({
      valid: true,
      promoCode: {
        id: "ckpromo000000000000000001",
        discountType: DiscountType.PERCENTAGE,
        discountValue: new Prisma.Decimal(10),
      },
    });

    getStripeClientMock.mockReturnValue({
      paymentIntents: {
        create: vi.fn().mockResolvedValue({ id: "pi_123", client_secret: "cs_test_123" }),
      },
    });

    getServerSessionMock.mockResolvedValue(null);
    attendeeProfileFindUniqueMock.mockResolvedValue({ id: "attendee-profile-1" });
    orderUpdateMock.mockResolvedValue({});

    orderCreateMock.mockResolvedValue({
      id: "order-1",
      subtotal: new Prisma.Decimal(100),
      discountAmount: new Prisma.Decimal(10),
      platformFee: new Prisma.Decimal(9),
      gst: new Prisma.Decimal(14.85),
      total: new Prisma.Decimal(113.85),
      items: [{ id: "item-1", ticketTypeId: "ticket-1", quantity: 2 }],
    });
    txEventFindFirstMock.mockResolvedValue(null);
    txEventSeatBookingDeleteManyMock.mockResolvedValue({ count: 0 });
    txPromoCodeUpdateMock.mockResolvedValue({});

    prismaTransactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        event: { findFirst: txEventFindFirstMock },
        eventSeatBooking: { deleteMany: txEventSeatBookingDeleteManyMock },
        order: { create: orderCreateMock },
        promoCode: { update: txPromoCodeUpdateMock },
      }),
    );
  });

  it("creates promo code via organizer API", async () => {
    const eventId = "ckevent000000000000000001";
    eventFindFirstMock.mockResolvedValue({ id: eventId });

    const req = new NextRequest("http://localhost/api/organizer/promo-codes", {
      method: "POST",
      body: JSON.stringify({
        code: "save10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        eventId,
        maxUses: 100,
        isActive: true,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await organizerPromoCreatePost(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.data.code).toBe("SAVE10");
    expect(promoCodeCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "SAVE10",
          discountType: "PERCENTAGE",
          discountValue: 10,
          eventId,
        }),
      }),
    );
  });

  it("validates promo codes for valid, expired, and maxUses exceeded cases", async () => {
    const createReq = () => new NextRequest("http://localhost/api/checkout/validate-promo", {
      method: "POST",
      body: JSON.stringify({ code: "SAVE10", eventId: "event-1" }),
      headers: { "content-type": "application/json" },
    });

    const validRes = await validatePromoPost(createReq());
    const validPayload = await validRes.json();
    expect(validRes.status).toBe(200);
    expect(validPayload.data.valid).toBe(true);

    validatePromoCodeByCodeMock.mockResolvedValueOnce({ valid: false, message: "Promo code has expired" });
    const expiredRes = await validatePromoPost(createReq());
    const expiredPayload = await expiredRes.json();
    expect(expiredRes.status).toBe(200);
    expect(expiredPayload.data.valid).toBe(false);
    expect(expiredPayload.data.message).toContain("expired");

    validatePromoCodeByCodeMock.mockResolvedValueOnce({ valid: false, message: "Promo code usage limit reached" });
    const maxUseRes = await validatePromoPost(createReq());
    const maxUsePayload = await maxUseRes.json();
    expect(maxUseRes.status).toBe(200);
    expect(maxUsePayload.data.valid).toBe(false);
    expect(maxUsePayload.data.message).toContain("limit");
  });

  it("applies promo in checkout and increments promo usedCount", async () => {
    const promoCodeId = "ckpromo000000000000000001";
    const publishedEvent = {
      id: "event-1",
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
    eventFindFirstMock.mockResolvedValue(publishedEvent);
    txEventFindFirstMock.mockResolvedValue(publishedEvent);

    const req = new NextRequest("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({
        eventId: "event-1",
        buyerName: "Test Buyer",
        buyerEmail: "buyer@example.com",
        promoCodeId,
        items: [{ ticketTypeId: "ticket-1", quantity: 2 }],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await checkoutPost(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.summary.discountAmount).toBeGreaterThan(0);
    expect(orderCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promoCodeId,
          discountAmount: 10,
        }),
      }),
    );
    expect(txPromoCodeUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: promoCodeId },
        data: { usedCount: { increment: 1 } },
      }),
    );
  });
});
