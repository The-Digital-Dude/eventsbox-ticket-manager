import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { writeAuditLog } from "@/src/lib/services/audit";
import { bulkEventActionSchema } from "@/src/lib/validators/admin";

function getBulkUpdateData(action: "APPROVE" | "REJECT" | "FEATURE" | "UNFEATURE") {
  switch (action) {
    case "APPROVE":
      return {
        status: "PUBLISHED" as const,
        publishedAt: new Date(),
        rejectionReason: null,
      };
    case "REJECT":
      return {
        status: "REJECTED" as const,
        rejectionReason: "Rejected via bulk admin action",
      };
    case "FEATURE":
      return {
        isFeatured: true,
      };
    case "UNFEATURE":
      return {
        isFeatured: false,
      };
  }
}

function getAuditAction(action: "APPROVE" | "REJECT" | "FEATURE" | "UNFEATURE") {
  switch (action) {
    case "APPROVE":
      return "EVENT_BULK_APPROVED";
    case "REJECT":
      return "EVENT_BULK_REJECTED";
    case "FEATURE":
      return "EVENT_BULK_FEATURED";
    case "UNFEATURE":
      return "EVENT_BULK_UNFEATURED";
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.SUPER_ADMIN);
    const parsed = bulkEventActionSchema.safeParse(await req.json());

    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid bulk action payload",
        details: parsed.error.flatten(),
      });
    }

    const ids = [...new Set(parsed.data.ids)];
    const events = await prisma.event.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, isFeatured: true },
    });

    if (events.length === 0) {
      return fail(404, { code: "NOT_FOUND", message: "No matching events found" });
    }

    const result = await prisma.event.updateMany({
      where: { id: { in: events.map((event) => event.id) } },
      data: getBulkUpdateData(parsed.data.action),
    });

    await Promise.all(
      events.map((event) =>
        writeAuditLog({
          actorUserId: auth.sub,
          action: getAuditAction(parsed.data.action),
          entityType: "Event",
          entityId: event.id,
          metadata: {
            bulkAction: parsed.data.action,
            previousStatus: event.status,
            previousIsFeatured: event.isFeatured,
          },
        }),
      ),
    );

    return ok({ updated: result.count });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Admin access required" });
    }

    console.error("[app/api/admin/events/bulk/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to process bulk event action" });
  }
}
