import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

const {
  requireAttendeeMock,
  requireRoleMock,
  attendeeProfileFindUniqueMock,
  eventFindUniqueMock,
  orderFindFirstMock,
  eventReviewFindFirstMock,
  eventReviewCreateMock,
  eventReviewFindUniqueMock,
  eventReviewDeleteMock,
  eventReviewUpdateMock,
  eventReviewFindManyMock,
  eventReviewCountMock,
  syncEventReviewSummaryMock,
  writeAuditLogMock,
  transactionMock,
  publicEventFindFirstMock,
  orderAddOnAggregateMock,
} = vi.hoisted(() => ({
  requireAttendeeMock: vi.fn(),
  requireRoleMock: vi.fn(),
  attendeeProfileFindUniqueMock: vi.fn(),
  eventFindUniqueMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  eventReviewFindFirstMock: vi.fn(),
  eventReviewCreateMock: vi.fn(),
  eventReviewFindUniqueMock: vi.fn(),
  eventReviewDeleteMock: vi.fn(),
  eventReviewUpdateMock: vi.fn(),
  eventReviewFindManyMock: vi.fn(),
  eventReviewCountMock: vi.fn(),
  syncEventReviewSummaryMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  transactionMock: vi.fn(),
  publicEventFindFirstMock: vi.fn(),
  orderAddOnAggregateMock: vi.fn(),
}));

vi.mock("@/src/lib/auth/require-attendee", () => ({
  requireAttendee: requireAttendeeMock,
}));

vi.mock("@/src/lib/auth/guards", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/src/lib/services/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("@/src/lib/services/event-reviews", () => ({
  syncEventReviewSummary: syncEventReviewSummaryMock,
  getReviewAttendeeName: (review: { attendee?: { displayName: string | null } | null; order?: { buyerName: string | null } | null }) =>
    review.attendee?.displayName ?? review.order?.buyerName ?? "Anonymous",
}));



vi.mock("@/src/lib/db", () => ({
  prisma: {
    attendeeProfile: {
      findUnique: attendeeProfileFindUniqueMock,
    },
    event: {
      findUnique: eventFindUniqueMock,
      findFirst: publicEventFindFirstMock,
    },
    order: {
      findFirst: orderFindFirstMock,
    },
    eventReview: {
      findFirst: eventReviewFindFirstMock,
      findUnique: eventReviewFindUniqueMock,
      findMany: eventReviewFindManyMock,
      count: eventReviewCountMock,
    },
    orderAddOn: {
      aggregate: orderAddOnAggregateMock,
    },
    $transaction: transactionMock,
  },
}));

import { GET as publicEventGet } from "@/app/api/public/events/[slug]/route";
import { GET as accountReviewGet, POST as accountReviewPost } from "@/app/api/account/events/[id]/review/route";
import { DELETE as deleteReview } from "@/app/api/account/reviews/[reviewId]/route";
import { PATCH as adminReviewPatch } from "@/app/api/admin/reviews/[id]/route";

describe("event reviews integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAttendeeMock.mockResolvedValue({ user: { id: "attendee-user-1" } });
    requireRoleMock.mockResolvedValue({ sub: "admin-user-1", role: "SUPER_ADMIN" });
    attendeeProfileFindUniqueMock.mockResolvedValue({ id: "attendee-profile-1" });
    eventFindUniqueMock.mockResolvedValue({
      id: "event-1",
      title: "Launch Night",
      slug: "launch-night",
      endAt: new Date("2026-01-10T20:00:00.000Z"),
    });
    orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      buyerName: "Jamie Doe",
    });
    eventReviewFindFirstMock.mockResolvedValue(null);
    eventReviewFindUniqueMock.mockResolvedValue({
      id: "review-1",
      attendeeUserId: "attendee-profile-1",
      eventId: "event-1",
      isVisible: true,
    });
    eventReviewFindManyMock.mockResolvedValue([]);
    eventReviewCountMock.mockResolvedValue(0);
    orderAddOnAggregateMock.mockResolvedValue({ _sum: { quantity: 0 } });
    syncEventReviewSummaryMock.mockResolvedValue({ reviewCount: 1, avgRating: 5 });
    writeAuditLogMock.mockResolvedValue(undefined);
    eventReviewCreateMock.mockResolvedValue({
      id: "review-1",
      rating: 5,
      comment: "Loved it",
      isVisible: true,
      createdAt: new Date("2026-01-11T09:00:00.000Z"),
      attendee: { displayName: "Jamie" },
      order: { buyerName: "Jamie Doe" },
    });
    eventReviewDeleteMock.mockResolvedValue(undefined);
    eventReviewUpdateMock.mockResolvedValue({
      id: "review-1",
      eventId: "event-1",
      isVisible: false,
    });
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        eventReview: {
          create: eventReviewCreateMock,
          delete: eventReviewDeleteMock,
          update: eventReviewUpdateMock,
        },
      }),
    );

    publicEventFindFirstMock.mockResolvedValue({
      id: "event-1",
      title: "Launch Night",
      slug: "launch-night",
      heroImage: null,
      images: [],
      videoUrl: null,
      description: null,
      startAt: new Date("2026-01-10T18:00:00.000Z"),
      endAt: new Date("2026-01-10T20:00:00.000Z"),
      timezone: "UTC",
      contactEmail: null,
      contactPhone: null,
      cancelPolicy: null,
      refundPolicy: null,
      currency: "USD",
      gstPct: 15,
      commissionPct: 10,
      platformFeeFixed: 0,
      tags: [],
      audience: null,
      category: null,
      series: null,
      venue: null,
      state: null,
      city: null,
      ticketTypes: [],
      addOns: [],
      organizerProfile: {
        id: "organizer-1",
        companyName: "Events Co",
        brandName: "Events Co",
        website: null,
        supportEmail: null,
      },
      reviewCount: 1,
      avgRating: 4,
      reviews: [
        {
          id: "review-1",
          rating: 4,
          comment: "Visible review",
          createdAt: new Date("2026-01-11T09:00:00.000Z"),
          attendee: { displayName: "Taylor" },
          order: { buyerName: "Taylor" },
        },
      ],
    });
  });

  it("creates a review for an attendee with a paid order", async () => {
    const req = new NextRequest("http://localhost/api/account/events/event-1/review", {
      method: "POST",
      body: JSON.stringify({ rating: 5, comment: "Loved it" }),
      headers: { "content-type": "application/json" },
    });

    const res = await accountReviewPost(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(eventReviewCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: "event-1",
          attendeeUserId: "attendee-profile-1",
          orderId: "order-1",
          rating: 5,
        }),
      }),
    );
    expect(syncEventReviewSummaryMock).toHaveBeenCalledWith("event-1", expect.anything());
  });

  it("returns 403 when a non-attendee tries to submit a review", async () => {
    requireAttendeeMock.mockRejectedValueOnce(new Error("FORBIDDEN"));

    const req = new NextRequest("http://localhost/api/account/events/event-1/review", {
      method: "POST",
      body: JSON.stringify({ rating: 4 }),
      headers: { "content-type": "application/json" },
    });

    const res = await accountReviewPost(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("returns 409 for a duplicate review", async () => {
    eventReviewCreateMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const req = new NextRequest("http://localhost/api/account/events/event-1/review", {
      method: "POST",
      body: JSON.stringify({ rating: 4 }),
      headers: { "content-type": "application/json" },
    });

    const res = await accountReviewPost(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.error.code).toBe("ALREADY_REVIEWED");
  });

  it("returns only visible reviews in the public event payload", async () => {
    const req = new NextRequest("http://localhost/api/public/events/launch-night");
    const res = await publicEventGet(req, { params: Promise.resolve({ slug: "launch-night" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.totalReviewCount).toBe(1);
    expect(payload.data.averageRating).toBe(4);
    expect(payload.data.reviews).toEqual([
      expect.objectContaining({
        id: "review-1",
        attendeeName: "Taylor",
      }),
    ]);
  });

  it("allows admins to hide and show a review", async () => {
    const req = new NextRequest("http://localhost/api/admin/reviews/review-1", {
      method: "PATCH",
      body: JSON.stringify({ isVisible: false }),
      headers: { "content-type": "application/json" },
    });

    const res = await adminReviewPatch(req, { params: Promise.resolve({ id: "review-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.isVisible).toBe(false);
    expect(syncEventReviewSummaryMock).toHaveBeenCalledWith("event-1", expect.anything());
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EVENT_REVIEW_HIDDEN",
        entityType: "EventReview",
        entityId: "review-1",
      }),
    );
  });

  it("deletes an attendee's own review", async () => {
    const req = new NextRequest("http://localhost/api/account/reviews/review-1", {
      method: "DELETE",
    });

    const res = await deleteReview(req, { params: Promise.resolve({ reviewId: "review-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.deleted).toBe(true);
    expect(eventReviewDeleteMock).toHaveBeenCalledWith({
      where: { id: "review-1" },
    });
    expect(syncEventReviewSummaryMock).toHaveBeenCalledWith("event-1", expect.anything());
  });

  it("returns attendee review eligibility from the account event endpoint", async () => {
    eventReviewFindFirstMock.mockResolvedValueOnce({
      id: "review-1",
      rating: 5,
      comment: "Loved it",
      isVisible: true,
      createdAt: new Date("2026-01-11T09:00:00.000Z"),
      attendee: { displayName: "Jamie" },
      order: { buyerName: "Jamie Doe" },
    });

    const req = new NextRequest("http://localhost/api/account/events/event-1/review");
    const res = await accountReviewGet(req, { params: Promise.resolve({ id: "event-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.data.review).toEqual(
      expect.objectContaining({
        id: "review-1",
        attendeeName: "Jamie",
      }),
    );
    expect(payload.data.canReview).toBe(false);
  });
});
