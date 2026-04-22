import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { getReviewAttendeeName } from "@/src/lib/services/event-reviews";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const event = await prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      slug: true,
      heroImage: true,
      images: true,
      videoUrl: true,
      description: true,
      startAt: true,
      endAt: true,
      timezone: true,
      contactEmail: true,
      contactPhone: true,
      cancelPolicy: true,
      refundPolicy: true,
      currency: true,
      gstPct: true,
      commissionPct: true,
      platformFeeFixed: true,
      tags: true,
      audience: true,
      category: { select: { id: true, name: true } },
      venue: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          lat: true,
          lng: true,
        },
      },
      seatingMode: true,
      seatingPlan: {
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              key: true,
              name: true,
              sectionType: true,
              capacity: true,
              sortOrder: true,
            },
          },
        },
      },
      state: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
      series: { select: { id: true, title: true } },
      addOns: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          maxPerOrder: true,
          totalStock: true,
        },
      },
      ticketTypes: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          kind: true,
          classType: true,
          sourceSeatingSectionId: true,
          price: true,
          quantity: true,
          sold: true,
          reservedQty: true,
          maxPerOrder: true,
          saleStartAt: true,
          saleEndAt: true,
        },
      },
      organizerProfile: {
        select: {
          id: true,
          companyName: true,
          brandName: true,
          website: true,
          supportEmail: true,
        },
      },
      reviewCount: true,
      avgRating: true,
      reviews: {
        where: { isVisible: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          comment: true,
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
      },
    },
  });

  if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

  const addOnsWithStock = await Promise.all(
    (event.addOns ?? []).map(async (a) => {
      if (a.totalStock === null) return { ...a, remainingStock: null };
      const agg = await prisma.orderAddOn.aggregate({
        where: { addOnId: a.id, order: { status: "PAID" } },
        _sum: { quantity: true },
      });
      const sold = agg._sum.quantity || 0;
      return { ...a, remainingStock: Math.max(0, a.totalStock - sold) };
    })
  );

  return ok({
    ...event,
    addOns: addOnsWithStock,
    ticketTypes: event.ticketTypes.map((ticketType) => ({
      ...ticketType,
      sectionId: ticketType.sourceSeatingSectionId,
    })),
    images: event.images ?? [],
    averageRating: event.avgRating,
    totalReviewCount: event.reviewCount,
    reviews: (event.reviews ?? []).map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      attendeeName: getReviewAttendeeName(review),
    })),
  });
}
