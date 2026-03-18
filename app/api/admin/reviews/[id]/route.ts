import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { writeAuditLog } from "@/src/lib/services/audit";
import { syncEventReviewSummary } from "@/src/lib/services/event-reviews";

const updateReviewSchema = z.object({
  isVisible: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.SUPER_ADMIN);
    const parsed = updateReviewSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid review update payload",
        details: parsed.error.flatten(),
      });
    }

    const { id } = await params;
    const existing = await prisma.eventReview.findUnique({
      where: { id },
      select: {
        id: true,
        eventId: true,
        isVisible: true,
      },
    });

    if (!existing) {
      return fail(404, { code: "NOT_FOUND", message: "Review not found" });
    }

    const review = await prisma.$transaction(async (tx) => {
      const updated = await tx.eventReview.update({
        where: { id: existing.id },
        data: {
          isVisible: parsed.data.isVisible,
        },
        select: {
          id: true,
          eventId: true,
          isVisible: true,
        },
      });

      await syncEventReviewSummary(existing.eventId, tx);

      return updated;
    });

    if (existing.isVisible !== review.isVisible) {
      await writeAuditLog({
        actorUserId: auth.sub,
        action: review.isVisible ? "EVENT_REVIEW_SHOWN" : "EVENT_REVIEW_HIDDEN",
        entityType: "EventReview",
        entityId: review.id,
        metadata: {
          previousIsVisible: existing.isVisible,
          nextIsVisible: review.isVisible,
        },
      });
    }

    return ok(review);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Super admin access required" });
    }

    console.error("[app/api/admin/reviews/[id]/route.ts][PATCH]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update review" });
  }
}
