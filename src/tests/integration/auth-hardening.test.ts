import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  userFindUniqueMock,
  attendeeProfileFindUniqueMock,
  orderFindManyMock,
  orderCountMock,
  eventReviewFindManyMock,
} = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  attendeeProfileFindUniqueMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderCountMock: vi.fn(),
  eventReviewFindManyMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
    attendeeProfile: {
      findUnique: attendeeProfileFindUniqueMock,
    },
    order: {
      findMany: orderFindManyMock,
      count: orderCountMock,
    },
    eventReview: {
      findMany: eventReviewFindManyMock,
    },
  },
}));

import { signAccessToken } from "@/src/lib/auth/jwt";
import { GET as accountOrdersGet } from "@/app/api/account/orders/route";

describe("auth hardening integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    attendeeProfileFindUniqueMock.mockResolvedValue({ id: "attendee-profile-1" });
    orderFindManyMock.mockResolvedValue([]);
    orderCountMock.mockResolvedValue(0);
    eventReviewFindManyMock.mockResolvedValue([]);
  });

  it("blocks suspended users even with a valid JWT, and allows the same token after reactivation", async () => {
    let isActive = false;

    userFindUniqueMock.mockImplementation(async () => ({
      id: "attendee-user-1",
      email: "attendee@example.com",
      role: "ATTENDEE",
      isActive,
    }));

    const token = signAccessToken({
      sub: "attendee-user-1",
      role: "ATTENDEE",
      email: "attendee@example.com",
    });

    const suspendedReq = new NextRequest("http://localhost/api/account/orders", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const suspendedRes = await accountOrdersGet(suspendedReq);
    const suspendedPayload = await suspendedRes.json();

    expect(suspendedRes.status).toBe(403);
    expect(suspendedPayload.error.code).toBe("ACCOUNT_SUSPENDED");

    isActive = true;

    const activeReq = new NextRequest("http://localhost/api/account/orders", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const activeRes = await accountOrdersGet(activeReq);
    const activePayload = await activeRes.json();

    expect(activeRes.status).toBe(200);
    expect(activePayload.data.orders).toEqual([]);
  });
});
