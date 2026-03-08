import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { writeAuditLog } from "@/src/lib/services/audit";

const featureEventSchema = z.object({
  isFeatured: z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;

    const parsed = featureEventSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid feature payload",
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.event.findUnique({
      where: { id },
      select: { id: true, isFeatured: true },
    });
    if (!existing) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { isFeatured: parsed.data.isFeatured },
      select: { id: true, isFeatured: true },
    });

    await writeAuditLog({
      actorUserId: auth.sub,
      action: updated.isFeatured ? "EVENT_FEATURED" : "EVENT_UNFEATURED",
      entityType: "Event",
      entityId: updated.id,
      metadata: {
        previousIsFeatured: existing.isFeatured,
        nextIsFeatured: updated.isFeatured,
      },
    });

    return ok({ isFeatured: updated.isFeatured });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Admin access required" });
    }

    console.error("[app/api/admin/events/[id]/feature/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update featured state" });
  }
}
