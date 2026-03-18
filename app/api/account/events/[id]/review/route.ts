import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { fail, ok } from "@/src/lib/http/response";
import { getReviewAttendeeName, syncEventReviewSummary } from "@/src/lib/services/event-reviews";

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

function authErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return fail(403, { code: "FORBIDDEN", message: "Attendee account required" });
  }

  return null;
}

async function getAttendeeProfileId(userId: string) {
  return prisma.attendeeProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
}

async function getEventReviewContext(eventId: string, attendeeProfileId: string) {
  const [event, paidOrder, review] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        slug: true,
        endAt: true,
      },
    }),
    prisma.order.findFirst({
      where: {
        eventId,
        attendeeUserId: attendeeProfileId,
        status: "PAID",
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        buyerName: true,
      },
    }),
    prisma.eventReview.findFirst({
      where: {
        eventId,
        attendeeUserId: attendeeProfileId,
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        isVisible: true,
        createdAt: true,
        attendee: {
          select: {
            displayName: true,
          },
        },
        order: {
          select: {
            buyerName: true,
          },
        },
      },
    }),
  ]);

  return {
    event,
    paidOrder,
    review,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAttendee(req);
    const profile = await getAttendeeProfileId(session.user.id);
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });
    }

    const { id } = await params;
    const { event, paidOrder, review } = await getEventReviewContext(id, profile.id);

    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const eventEnded = event.endAt.getTime() <= Date.now();

    return ok({
      eventId: event.id,
      eventSlug: event.slug,
      eventEnded,
      hasPaidOrder: Boolean(paidOrder),
      canReview: Boolean(paidOrder) && eventEnded && !review,
      review: review
        ? {
            ...review,
            attendeeName: getReviewAttendeeName(review),
          }
        : null,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/account/events/[id]/review/route.ts][GET]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load review state" });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAttendee(req);
    const profile = await getAttendeeProfileId(session.user.id);
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });
    }

    const parsed = reviewSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid review payload",
        details: parsed.error.flatten(),
      });
    }

    const { id } = await params;
    const { event, paidOrder } = await getEventReviewContext(id, profile.id);

    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    if (!paidOrder) {
      return fail(403, { code: "ATTENDANCE_REQUIRED", message: "Only attendees with a paid order can review this event" });
    }

    if (event.endAt.getTime() > Date.now()) {
      return fail(403, { code: "EVENT_NOT_ENDED", message: "You can review this event after it ends" });
    }

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.eventReview.create({
        data: {
          eventId: event.id,
          attendeeUserId: profile.id,
          orderId: paidOrder.id,
          rating: parsed.data.rating,
          comment: parsed.data.comment?.trim() || null,
          isVisible: true,
        },
        select: {
          id: true,
          rating: true,
          comment: true,
          isVisible: true,
          createdAt: true,
          attendee: {
            select: {
              displayName: true,
            },
          },
          order: {
            select: {
              buyerName: true,
            },
          },
        },
      });

      const summary = await syncEventReviewSummary(event.id, tx);

      return {
        ...created,
        attendeeName: getReviewAttendeeName(created),
        averageRating: summary.avgRating,
        totalReviewCount: summary.reviewCount,
      };
    });

    return ok(review, 201);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(409, { code: "ALREADY_REVIEWED", message: "You have already reviewed this event" });
    }

    console.error("[app/api/account/events/[id]/review/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to submit review" });
  }
}
