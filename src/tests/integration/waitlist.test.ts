import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  rateLimitRedisMock,
  eventFindFirstMock,
  waitlistFindUniqueMock,
  waitlistCreateMock,
  waitlistFindManyMock,
  waitlistUpdateManyMock,
  ticketTypeFindUniqueMock,
  sendWaitlistConfirmationEmailMock,
  sendWaitlistAvailabilityEmailMock,
} = vi.hoisted(() => ({
  rateLimitRedisMock: vi.fn(),
  eventFindFirstMock: vi.fn(),
  waitlistFindUniqueMock: vi.fn(),
  waitlistCreateMock: vi.fn(),
  waitlistFindManyMock: vi.fn(),
  waitlistUpdateManyMock: vi.fn(),
  ticketTypeFindUniqueMock: vi.fn(),
  sendWaitlistConfirmationEmailMock: vi.fn(),
  sendWaitlistAvailabilityEmailMock: vi.fn(),
}));

vi.mock("@/src/lib/http/rate-limit-redis", () => ({
  rateLimitRedis: rateLimitRedisMock,
}));

vi.mock("@/src/lib/services/notifications", () => ({
  sendWaitlistConfirmationEmail: sendWaitlistConfirmationEmailMock,
  sendWaitlistAvailabilityEmail: sendWaitlistAvailabilityEmailMock,
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      findFirst: eventFindFirstMock,
    },
    waitlist: {
      findUnique: waitlistFindUniqueMock,
      create: waitlistCreateMock,
      findMany: waitlistFindManyMock,
      updateMany: waitlistUpdateManyMock,
    },
    ticketType: {
      findUnique: ticketTypeFindUniqueMock,
    },
  },
}));

import { POST as waitlistJoinPost } from "@/app/api/events/[slug]/waitlist/route";
import { notifyWaitlist } from "@/src/lib/services/waitlist";

describe("waitlist integration", () => {
  const eventId = "ckevent000000000000000001";
  const ticketTypeId = "ckticket000000000000000001";

  beforeEach(() => {
    vi.clearAllMocks();

    rateLimitRedisMock.mockResolvedValue({ limited: false });
    eventFindFirstMock.mockResolvedValue({
      id: eventId,
      title: "Summer Fest",
      ticketTypes: [{
        id: ticketTypeId,
        name: "General",
        quantity: 100,
        sold: 100,
      }],
    });
    waitlistFindUniqueMock.mockResolvedValue(null);
    waitlistCreateMock.mockResolvedValue({ id: "waitlist-1" });
    sendWaitlistConfirmationEmailMock.mockResolvedValue({ sent: true, skipped: false });

    ticketTypeFindUniqueMock.mockResolvedValue({
      id: ticketTypeId,
      name: "General",
      event: {
        title: "Summer Fest",
        slug: "summer-fest",
      },
    });
    waitlistFindManyMock.mockResolvedValue([
      { id: "wait-1", email: "one@example.com", name: "One" },
      { id: "wait-2", email: "two@example.com", name: "Two" },
    ]);
    waitlistUpdateManyMock.mockResolvedValue({ count: 2 });
    sendWaitlistAvailabilityEmailMock.mockResolvedValue({ sent: true, skipped: false });
  });

  it("joins waitlist for sold-out tickets", async () => {
    const req = new NextRequest("http://localhost/api/events/summer-fest/waitlist", {
      method: "POST",
      body: JSON.stringify({
        email: "Buyer@Example.com",
        name: "Buyer",
        ticketTypeId,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await waitlistJoinPost(req, { params: Promise.resolve({ slug: "summer-fest" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.joined).toBe(true);
    expect(waitlistCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId,
          ticketTypeId,
          email: "buyer@example.com",
          name: "Buyer",
        }),
      }),
    );
    expect(sendWaitlistConfirmationEmailMock).toHaveBeenCalled();
  });

  it("returns alreadyJoined for duplicate waitlist join", async () => {
    waitlistFindUniqueMock.mockResolvedValueOnce({ id: "wait-existing" });

    const req = new NextRequest("http://localhost/api/events/summer-fest/waitlist", {
      method: "POST",
      body: JSON.stringify({
        email: "buyer@example.com",
        ticketTypeId,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await waitlistJoinPost(req, { params: Promise.resolve({ slug: "summer-fest" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.alreadyJoined).toBe(true);
    expect(waitlistCreateMock).not.toHaveBeenCalled();
  });

  it("fails join when tickets are still available", async () => {
    eventFindFirstMock.mockResolvedValueOnce({
      id: eventId,
      title: "Summer Fest",
      ticketTypes: [{
        id: ticketTypeId,
        name: "General",
        quantity: 100,
        sold: 99,
      }],
    });

    const req = new NextRequest("http://localhost/api/events/summer-fest/waitlist", {
      method: "POST",
      body: JSON.stringify({
        email: "buyer@example.com",
        ticketTypeId,
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await waitlistJoinPost(req, { params: Promise.resolve({ slug: "summer-fest" }) });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("TICKETS_AVAILABLE");
  });

  it("notifyWaitlist marks notifiedAt for selected entries", async () => {
    await notifyWaitlist(ticketTypeId, 2);

    expect(waitlistFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ticketTypeId,
          notifiedAt: null,
        }),
        take: 2,
      }),
    );
    expect(sendWaitlistAvailabilityEmailMock).toHaveBeenCalledTimes(2);
    expect(waitlistUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["wait-1", "wait-2"] } },
        data: { notifiedAt: expect.any(Date) },
      }),
    );
  });
});
