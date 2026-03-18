import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { getReviewAttendeeName } from "@/src/lib/services/event-reviews";

const PAGE_SIZE = 20;

function parsePage(value: string | null) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function parseVisibility(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);

    const page = parsePage(req.nextUrl.searchParams.get("page"));
    const eventId = req.nextUrl.searchParams.get("eventId")?.trim();
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const isVisible = parseVisibility(req.nextUrl.searchParams.get("isVisible"));

    const where = {
      ...(eventId ? { eventId } : {}),
      ...(typeof isVisible === "boolean" ? { isVisible } : {}),
      ...(q
        ? {
            OR: [
              { event: { title: { contains: q, mode: "insensitive" as const } } },
              { comment: { contains: q, mode: "insensitive" as const } },
              { order: { buyerName: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [reviews, total] = await Promise.all([
      prisma.eventReview.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          rating: true,
          comment: true,
          isVisible: true,
          createdAt: true,
          eventId: true,
          event: {
            select: {
              title: true,
              slug: true,
            },
          },
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
      prisma.eventReview.count({ where }),
    ]);

    return ok({
      reviews: reviews.map((review) => ({
        ...review,
        attendeeName: getReviewAttendeeName(review),
      })),
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Super admin access required" });
    }

    console.error("[app/api/admin/reviews/route.ts][GET]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load reviews" });
  }
}
