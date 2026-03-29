import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";

type ReviewAggregateClient = Prisma.TransactionClient | typeof prisma;

type ReviewIdentity = {
  attendee?: { displayName: string | null } | null;
  order?: { buyerName: string | null } | null;
};

export function getReviewAttendeeName(review: ReviewIdentity) {
  const displayName = review.attendee?.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  const buyerName = review.order?.buyerName?.trim();
  if (buyerName) {
    return buyerName;
  }

  return "Anonymous";
}

export async function syncEventReviewSummary(eventId: string, tx: ReviewAggregateClient = prisma) {
  const summary = await tx.eventReview.aggregate({
    where: {
      eventId,
      isVisible: true,
    },
    _avg: {
      rating: true,
    },
    _count: {
      id: true,
    },
  });

  const reviewCount = summary._count.id ?? 0;
  const avgRating = reviewCount > 0 ? Number((summary._avg.rating ?? 0).toFixed(1)) : 0;

  await tx.event.update({
    where: { id: eventId },
    data: {
      reviewCount,
      avgRating,
    },
  });

  return {
    reviewCount,
    avgRating,
  };
}
