import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAttendeeMock,
  attendeeProfileFindUniqueMock,
  qrTicketFindUniqueMock,
  generateQrPngBufferMock,
} = vi.hoisted(() => ({
  requireAttendeeMock: vi.fn(),
  attendeeProfileFindUniqueMock: vi.fn(),
  qrTicketFindUniqueMock: vi.fn(),
  generateQrPngBufferMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/require-attendee", () => ({
  requireAttendee: requireAttendeeMock,
}));

vi.mock("@/src/lib/qr", () => ({
  generateQrPngBuffer: generateQrPngBufferMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    attendeeProfile: {
      findUnique: attendeeProfileFindUniqueMock,
    },
    qRTicket: {
      findUnique: qrTicketFindUniqueMock,
    },
  },
}));

import { GET } from "@/app/api/account/tickets/[ticketId]/qr/route";

describe("ticket wallet integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAttendeeMock.mockResolvedValue({
      user: { id: "user-1", role: "ATTENDEE" },
    });
    attendeeProfileFindUniqueMock.mockResolvedValue({ id: "profile-1" });
    qrTicketFindUniqueMock.mockResolvedValue({
      id: "ticket-1",
      ticketNumber: "TKT-001",
      order: {
        attendeeUserId: "profile-1",
        status: "PAID",
      },
    });
    generateQrPngBufferMock.mockResolvedValue(Buffer.from([1, 2, 3, 4]));
  });

  it("returns PNG QR for the ticket owner", async () => {
    const req = new NextRequest("http://localhost/api/account/tickets/ticket-1/qr", {
      method: "GET",
    });

    const res = await GET(req, { params: Promise.resolve({ ticketId: "ticket-1" }) });
    const body = new Uint8Array(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(body).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(generateQrPngBufferMock).toHaveBeenCalledWith("ticket-1");
  });

  it("returns 403 when the ticket belongs to another attendee", async () => {
    qrTicketFindUniqueMock.mockResolvedValueOnce({
      id: "ticket-1",
      ticketNumber: "TKT-001",
      order: {
        attendeeUserId: "profile-2",
        status: "PAID",
      },
    });

    const req = new NextRequest("http://localhost/api/account/tickets/ticket-1/qr", {
      method: "GET",
    });

    const res = await GET(req, { params: Promise.resolve({ ticketId: "ticket-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(generateQrPngBufferMock).not.toHaveBeenCalled();
  });
});
