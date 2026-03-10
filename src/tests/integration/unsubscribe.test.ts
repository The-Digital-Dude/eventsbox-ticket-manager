import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  userFindUniqueMock,
  userUpdateMock,
  resendSendMock,
} = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  userUpdateMock: vi.fn(),
  resendSendMock: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: resendSendMock,
    };
  },
}));

vi.mock("@/src/lib/env", () => ({
  env: {
    APP_URL: "http://localhost:3000",
    RESEND_API_KEY: "test-key",
    EMAIL_FROM: "EventsBox <no-reply@example.com>",
    EMAIL_REPLY_TO: "",
  },
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
      update: userUpdateMock,
    },
  },
}));

import { GET } from "@/app/api/unsubscribe/route";
import {
  sendWaitlistAvailabilityEmail,
  sendWaitlistConfirmationEmail,
} from "@/src/lib/services/notifications";

describe("unsubscribe integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userUpdateMock.mockResolvedValue({ id: "user-1", marketingOptOut: true });
    resendSendMock.mockResolvedValue({ error: null });
  });

  it("marks marketing opt-out true for a valid token", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "user-1",
      email: "buyer@example.com",
    });

    const req = new NextRequest("http://localhost/api/unsubscribe?token=valid-token");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data).toEqual({
      unsubscribed: true,
      email: "buyer@example.com",
    });
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { marketingOptOut: true },
    });
  });

  it("returns 400 for an invalid token", async () => {
    userFindUniqueMock.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/unsubscribe?token=invalid-token");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_TOKEN");
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("skips waitlist emails for opted-out users", async () => {
    userFindUniqueMock.mockResolvedValue({
      marketingOptOut: true,
      unsubscribeToken: "opted-out-token",
    });

    const result = await sendWaitlistAvailabilityEmail({
      to: "buyer@example.com",
      name: "Buyer",
      ticketName: "VIP",
      eventTitle: "Launch Night",
      eventUrl: "http://localhost:3000/events/launch-night",
    });

    expect(result).toEqual({
      sent: false,
      skipped: true,
      reason: "OPT_OUT",
    });
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("includes an unsubscribe footer for waitlist confirmations when allowed", async () => {
    userFindUniqueMock.mockResolvedValue({
      marketingOptOut: false,
      unsubscribeToken: "footer-token",
    });

    await sendWaitlistConfirmationEmail({
      to: "buyer@example.com",
      name: "Buyer",
      ticketName: "General Admission",
      eventTitle: "Launch Night",
    });

    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("http://localhost:3000/unsubscribe?token=footer-token"),
        html: expect.stringContaining("/unsubscribe?token=footer-token"),
      }),
    );
  });
});
