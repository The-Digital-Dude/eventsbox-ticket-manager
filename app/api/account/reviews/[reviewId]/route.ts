import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { fail, ok } from "@/src/lib/http/response";
import { syncEventReviewSummary } from "@/src/lib/services/event-reviews";

function authErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return fail(403, { code: "FORBIDDEN", message: "Attendee account required" });
  }

  return null;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    const session = await requireAttendee(req);
    const profile = await prisma.attendeeProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });
    }

    const { reviewId } = await params;
    const review = await prisma.eventReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        attendeeUserId: true,
        eventId: true,
      },
    });

    if (!review) {
      return fail(404, { code: "NOT_FOUND", message: "Review not found" });
    }

    if (review.attendeeUserId !== profile.id) {
      return fail(403, { code: "FORBIDDEN", message: "You can only delete your own review" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.eventReview.delete({
        where: { id: review.id },
      });

      await syncEventReviewSummary(review.eventId, tx);
    });

    return ok({ deleted: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/account/reviews/[reviewId]/route.ts][DELETE]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to delete review" });
  }
}
