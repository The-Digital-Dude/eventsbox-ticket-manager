import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAttendeeMock,
  attendeeProfileFindUniqueMock,
  attendeeProfileFindFirstMock,
  qrTicketFindFirstMock,
  ticketTransferCreateMock,
  ticketTransferFindUniqueMock,
  ticketTransferUpdateMock,
  prismaTransactionMock,
  txOrderUpdateMock,
  txTicketTransferUpdateMock,
  sendTicketTransferInviteEmailMock,
  sendTicketTransferSenderEmailMock,
  sendTicketTransferAcceptedRecipientEmailMock,
  sendTicketTransferAcceptedSenderEmailMock,
} = vi.hoisted(() => ({
  requireAttendeeMock: vi.fn(),
  attendeeProfileFindUniqueMock: vi.fn(),
  attendeeProfileFindFirstMock: vi.fn(),
  qrTicketFindFirstMock: vi.fn(),
  ticketTransferCreateMock: vi.fn(),
  ticketTransferFindUniqueMock: vi.fn(),
  ticketTransferUpdateMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
  txOrderUpdateMock: vi.fn(),
  txTicketTransferUpdateMock: vi.fn(),
  sendTicketTransferInviteEmailMock: vi.fn(),
  sendTicketTransferSenderEmailMock: vi.fn(),
  sendTicketTransferAcceptedRecipientEmailMock: vi.fn(),
  sendTicketTransferAcceptedSenderEmailMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/require-attendee", () => ({
  requireAttendee: requireAttendeeMock,
}));

vi.mock("@/src/lib/env", () => ({
  env: {
    APP_URL: "http://localhost:3000",
  },
}));

vi.mock("@/src/lib/services/notifications", () => ({
  sendTicketTransferInviteEmail: sendTicketTransferInviteEmailMock,
  sendTicketTransferSenderEmail: sendTicketTransferSenderEmailMock,
  sendTicketTransferAcceptedRecipientEmail: sendTicketTransferAcceptedRecipientEmailMock,
  sendTicketTransferAcceptedSenderEmail: sendTicketTransferAcceptedSenderEmailMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    attendeeProfile: {
      findUnique: attendeeProfileFindUniqueMock,
      findFirst: attendeeProfileFindFirstMock,
    },
    qRTicket: {
      findFirst: qrTicketFindFirstMock,
    },
    ticketTransfer: {
      create: ticketTransferCreateMock,
      findUnique: ticketTransferFindUniqueMock,
      update: ticketTransferUpdateMock,
    },
    $transaction: prismaTransactionMock,
  },
}));

import { POST as initiateTransferPost } from "@/app/api/account/orders/[orderId]/tickets/[ticketId]/transfer/route";
import { POST as acceptTransferPost } from "@/app/api/transfer/accept/route";

describe("ticket transfer integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAttendeeMock.mockResolvedValue({
      user: { id: "attendee-user-1", email: "buyer@example.com", role: "ATTENDEE" },
    });
    attendeeProfileFindUniqueMock.mockResolvedValue({ id: "attendee-profile-1" });
    attendeeProfileFindFirstMock.mockResolvedValue({ id: "recipient-profile-1" });
    qrTicketFindFirstMock.mockResolvedValue({
      id: "ticket-1",
      ticketNumber: "TKT-001",
      checkedInAt: null,
      order: {
        id: "order-1",
        buyerEmail: "buyer@example.com",
        status: "PAID",
        event: {
          title: "Launch Night",
          startAt: new Date("2026-08-15T18:00:00.000Z").toISOString(),
        },
        tickets: [{ id: "ticket-1" }],
      },
      transfers: [],
    });
    ticketTransferCreateMock.mockResolvedValue({
      id: "transfer-1",
      token: "token-123",
      expiresAt: new Date("2026-08-10T12:00:00.000Z"),
    });
    prismaTransactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        order: {
          update: txOrderUpdateMock,
        },
        ticketTransfer: {
          update: txTicketTransferUpdateMock,
        },
      }),
    );
    txOrderUpdateMock.mockResolvedValue(undefined);
    txTicketTransferUpdateMock.mockResolvedValue(undefined);
    sendTicketTransferInviteEmailMock.mockResolvedValue({ sent: true, skipped: false });
    sendTicketTransferSenderEmailMock.mockResolvedValue({ sent: true, skipped: false });
    sendTicketTransferAcceptedRecipientEmailMock.mockResolvedValue({ sent: true, skipped: false });
    sendTicketTransferAcceptedSenderEmailMock.mockResolvedValue({ sent: true, skipped: false });
  });

  it("creates a pending transfer for an owned ticket", async () => {
    const req = new NextRequest("http://localhost/api/account/orders/order-1/tickets/ticket-1/transfer", {
      method: "POST",
      body: JSON.stringify({ toEmail: "friend@example.com", toName: "Friend" }),
      headers: { "content-type": "application/json" },
    });

    const res = await initiateTransferPost(req, {
      params: Promise.resolve({ orderId: "order-1", ticketId: "ticket-1" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.transferId).toBe("transfer-1");
    expect(ticketTransferCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qrTicketId: "ticket-1",
          toEmail: "friend@example.com",
          toName: "Friend",
        }),
      }),
    );
    expect(sendTicketTransferInviteEmailMock).toHaveBeenCalled();
  });

  it("accepts a valid transfer token and reassigns the order", async () => {
    ticketTransferFindUniqueMock.mockResolvedValue({
      id: "transfer-1",
      fromEmail: "buyer@example.com",
      toEmail: "friend@example.com",
      toName: "Friend",
      status: "PENDING",
      expiresAt: new Date("2026-08-10T12:00:00.000Z"),
      qrTicket: {
        id: "ticket-1",
        ticketNumber: "TKT-001",
        checkedInAt: null,
        order: {
          id: "order-1",
          status: "PAID",
          event: { title: "Launch Night" },
        },
      },
    });

    const req = new NextRequest("http://localhost/api/transfer/accept", {
      method: "POST",
      body: JSON.stringify({ token: "token-123" }),
      headers: { "content-type": "application/json" },
    });

    const res = await acceptTransferPost(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.ticketNumber).toBe("TKT-001");
    expect(txOrderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          buyerEmail: "friend@example.com",
          buyerName: "Friend",
          attendeeUserId: "recipient-profile-1",
        }),
      }),
    );
    expect(txTicketTransferUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACCEPTED",
        }),
      }),
    );
  });

  it("rejects duplicate accept attempts", async () => {
    ticketTransferFindUniqueMock.mockResolvedValue({
      id: "transfer-1",
      fromEmail: "buyer@example.com",
      toEmail: "friend@example.com",
      toName: "Friend",
      status: "ACCEPTED",
      expiresAt: new Date("2026-08-10T12:00:00.000Z"),
      qrTicket: {
        id: "ticket-1",
        ticketNumber: "TKT-001",
        checkedInAt: null,
        order: {
          id: "order-1",
          status: "PAID",
          event: { title: "Launch Night" },
        },
      },
    });

    const req = new NextRequest("http://localhost/api/transfer/accept", {
      method: "POST",
      body: JSON.stringify({ token: "token-123" }),
      headers: { "content-type": "application/json" },
    });

    const res = await acceptTransferPost(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_TRANSFER");
  });

  it("marks expired tokens as expired and returns an error", async () => {
    ticketTransferFindUniqueMock.mockResolvedValue({
      id: "transfer-1",
      fromEmail: "buyer@example.com",
      toEmail: "friend@example.com",
      toName: "Friend",
      status: "PENDING",
      expiresAt: new Date("2025-01-01T00:00:00.000Z"),
      qrTicket: {
        id: "ticket-1",
        ticketNumber: "TKT-001",
        checkedInAt: null,
        order: {
          id: "order-1",
          status: "PAID",
          event: { title: "Launch Night" },
        },
      },
    });
    ticketTransferUpdateMock.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/transfer/accept", {
      method: "POST",
      body: JSON.stringify({ token: "token-123" }),
      headers: { "content-type": "application/json" },
    });

    const res = await acceptTransferPost(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("TRANSFER_EXPIRED");
    expect(ticketTransferUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "EXPIRED" },
      }),
    );
  });
});
