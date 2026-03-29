import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireApprovedOrganizer } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { writeAuditLog } from "@/src/lib/services/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { payload, profile } = await requireApprovedOrganizer(req);
    const { id } = await params;

    const event = await prisma.event.findFirst({
      where: {
        id,
        organizerProfileId: profile.id,
      },
      select: {
        id: true,
        status: true,
        publishedAt: true,
      },
    });

    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    if (event.status === "PUBLISHED") {
      const updated = await prisma.event.update({
        where: { id: event.id },
        data: { status: "DRAFT" },
        select: { status: true },
      });

      await writeAuditLog({
        actorUserId: payload.sub,
        action: "EVENT_UNPUBLISHED",
        entityType: "Event",
        entityId: event.id,
      });

      return ok(updated);
    }

    if (event.status === "DRAFT") {
      if (!event.publishedAt) {
        return fail(400, {
          code: "NOT_YET_APPROVED",
          message: "Event must be approved by admin before it can be published.",
        });
      }

      const updated = await prisma.event.update({
        where: { id: event.id },
        data: { status: "PUBLISHED" },
        select: { status: true },
      });

      await writeAuditLog({
        actorUserId: payload.sub,
        action: "EVENT_REPUBLISHED",
        entityType: "Event",
        entityId: event.id,
      });

      return ok(updated);
    }

    return fail(400, { code: "INVALID_STATUS", message: "Event cannot be toggled in its current status" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
    }
    if (error instanceof Error && error.message === "ORGANIZER_NOT_APPROVED") {
      return fail(403, { code: "ORGANIZER_NOT_APPROVED", message: "Approved organizer account required" });
    }

    console.error("[app/api/organizer/events/[id]/publish/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update event status" });
  }
}
