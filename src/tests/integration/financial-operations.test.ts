import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireRoleMock,
  writeAuditLogMock,
  getStripeClientMock,
  payoutRequestFindUniqueMock,
  payoutRequestFindFirstMock,
  payoutRequestCreateMock,
  payoutRequestUpdateMock,
  organizerProfileFindManyMock,
  orderAggregateMock,
  orderFindManyMock,
  stripeTransfersCreateMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  getStripeClientMock: vi.fn(),
  payoutRequestFindUniqueMock: vi.fn(),
  payoutRequestFindFirstMock: vi.fn(),
  payoutRequestCreateMock: vi.fn(),
  payoutRequestUpdateMock: vi.fn(),
  organizerProfileFindManyMock: vi.fn(),
  orderAggregateMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  stripeTransfersCreateMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/src/lib/stripe/client", () => ({
  getStripeClient: getStripeClientMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    payoutRequest: {
      findUnique: payoutRequestFindUniqueMock,
      findFirst: payoutRequestFindFirstMock,
      create: payoutRequestCreateMock,
      update: payoutRequestUpdateMock,
    },
    organizerProfile: {
      findMany: organizerProfileFindManyMock,
    },
    order: {
      aggregate: orderAggregateMock,
      findMany: orderFindManyMock,
    },
  },
}));

import { POST as settlePost } from "@/app/api/admin/payouts/[id]/settle/route";
import { GET as taxReportGet } from "@/app/api/admin/reports/tax/route";
import { GET as refundsReportGet } from "@/app/api/admin/reports/refunds/route";
import { GET as autoPayoutsGet } from "@/app/api/cron/auto-payouts/route";

describe("financial operations integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireRoleMock.mockResolvedValue({ sub: "admin-1", role: "SUPER_ADMIN" });
    writeAuditLogMock.mockResolvedValue(undefined);
    getStripeClientMock.mockReturnValue({
      transfers: {
        create: stripeTransfersCreateMock,
      },
    });
    stripeTransfersCreateMock.mockResolvedValue({ id: "tr_123" });
  });

  it("settles an approved payout through Stripe transfer", async () => {
    payoutRequestFindUniqueMock.mockResolvedValue({
      id: "payout-1",
      status: "APPROVED",
      amount: 125,
      organizerProfile: {
        payoutSettings: {
          stripeAccountId: "acct_123",
        },
      },
    });
    payoutRequestUpdateMock.mockResolvedValue({});

    const res = await settlePost(
      new NextRequest("http://localhost/api/admin/payouts/payout-1/settle", { method: "POST" }),
      { params: Promise.resolve({ id: "payout-1" }) },
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(stripeTransfersCreateMock).toHaveBeenCalledWith({
      amount: 12500,
      currency: "usd",
      destination: "acct_123",
      metadata: { payoutRequestId: "payout-1" },
    });
    expect(payload.data.stripeTransferId).toBe("tr_123");
  });

  it("fails settlement when organizer has no connected Stripe account", async () => {
    payoutRequestFindUniqueMock.mockResolvedValue({
      id: "payout-1",
      status: "APPROVED",
      amount: 125,
      organizerProfile: {
        payoutSettings: null,
      },
    });

    const res = await settlePost(
      new NextRequest("http://localhost/api/admin/payouts/payout-1/settle", { method: "POST" }),
      { params: Promise.resolve({ id: "payout-1" }) },
    );
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("NO_STRIPE_ACCOUNT");
  });

  it("returns tax report CSV", async () => {
    orderFindManyMock.mockResolvedValue([
      {
        id: "order-1",
        total: 115,
        gst: 15,
        subtotal: 90,
        platformFee: 10,
        paidAt: new Date("2026-02-10T08:00:00.000Z"),
        buyerEmail: "buyer@example.com",
        event: { title: "City Fest" },
      },
    ]);

    const res = await taxReportGet(
      new NextRequest("http://localhost/api/admin/reports/tax?year=2026&quarter=1"),
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Order ID,Event,Buyer Email,Subtotal,GST,Platform Fee,Total,Paid At");
    expect(body).toContain("\"order-1\",\"City Fest\",\"buyer@example.com\",\"90.00\",\"15.00\",\"10.00\",\"115.00\"");
  });

  it("returns refund report CSV", async () => {
    orderFindManyMock.mockResolvedValue([
      {
        id: "order-2",
        total: 80,
        buyerEmail: "buyer@example.com",
        buyerName: "Buyer Example",
        updatedAt: new Date("2026-03-15T08:00:00.000Z"),
        stripePaymentIntentId: "pi_123",
        event: { title: "Refunded Event" },
      },
    ]);

    const res = await refundsReportGet(
      new NextRequest("http://localhost/api/admin/reports/refunds?from=2026-03-01&to=2026-03-31"),
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Order ID,Event,Buyer,Amount Refunded,Stripe PI ID,Refunded At");
    expect(body).toContain("\"order-2\",\"Refunded Event\",\"Buyer Example <buyer@example.com>\",\"80.00\",\"pi_123\"");
  });

  it("processes auto payouts for AUTO mode organizers above threshold", async () => {
    process.env.CRON_SECRET = "cron-secret-test";

    organizerProfileFindManyMock.mockResolvedValue([
      {
        id: "org-1",
        payoutSettings: {
          stripeAccountId: "acct_auto_1",
        },
      },
    ]);
    payoutRequestFindFirstMock.mockResolvedValue(null);
    orderAggregateMock.mockResolvedValue({ _sum: { total: 200 } });
    payoutRequestCreateMock.mockResolvedValue({ id: "payout-auto-1" });
    payoutRequestUpdateMock.mockResolvedValue({});

    const res = await autoPayoutsGet(
      new NextRequest("http://localhost/api/cron/auto-payouts", {
        headers: { authorization: "Bearer cron-secret-test" },
      }),
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payoutRequestCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizerProfileId: "org-1",
          note: "Auto-payout",
          status: "APPROVED",
        }),
      }),
    );
    expect(stripeTransfersCreateMock).toHaveBeenCalled();
    expect(payload.data.processed).toBe(1);
  });
});
