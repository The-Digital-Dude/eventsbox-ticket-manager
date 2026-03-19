import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  orderFindManyMock,
  orderUpdateMock,
  sendEventReminderEmailMock,
} = vi.hoisted(() => ({
  orderFindManyMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  sendEventReminderEmailMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    order: {
      findMany: orderFindManyMock,
      update: orderUpdateMock,
    },
  },
}));

vi.mock("@/src/lib/services/notifications", () => ({
  sendEventReminderEmail: sendEventReminderEmailMock,
}));

import { GET } from "@/app/api/cron/event-reminders/route";

describe("cron reminders integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-test";

    const order = {
      id: "order-1",
      buyerName: "Buyer One",
      buyerEmail: "buyer@example.com",
      event: {
        title: "City Expo",
        startAt: new Date(Date.now() + 30 * 60 * 60 * 1000),
        venue: {
          name: "Town Hall",
        },
      },
    };

    let pendingOrders = [order];

    orderFindManyMock.mockImplementation(async () => pendingOrders);
    orderUpdateMock.mockImplementation(async () => {
      pendingOrders = [];
      return {
        id: order.id,
        reminderSentAt: new Date(),
      };
    });
    sendEventReminderEmailMock.mockResolvedValue({ sent: true, skipped: false });
  });

  it("sends each reminder once and marks the order as reminded", async () => {
    const req = new NextRequest("http://localhost/api/cron/event-reminders", {
      headers: {
        authorization: "Bearer cron-secret-test",
      },
    });

    const firstRes = await GET(req);
    const firstPayload = await firstRes.json();

    expect(firstRes.status).toBe(200);
    expect(firstPayload.data.reminders).toBe(1);
    expect(sendEventReminderEmailMock).toHaveBeenCalledTimes(1);
    expect(orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { reminderSentAt: expect.any(Date) },
    });

    const secondRes = await GET(req);
    const secondPayload = await secondRes.json();

    expect(secondRes.status).toBe(200);
    expect(secondPayload.data.reminders).toBe(0);
    expect(sendEventReminderEmailMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthorized cron calls", async () => {
    const req = new NextRequest("http://localhost/api/cron/event-reminders");
    const res = await GET(req);
    const payload = await res.json();

    expect(res.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(sendEventReminderEmailMock).not.toHaveBeenCalled();
  });
});
