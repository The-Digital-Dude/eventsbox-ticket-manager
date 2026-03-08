import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { writeAuditLog } from "@/src/lib/services/audit";

const attendeeStatusPatchSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;

    const parsed = attendeeStatusPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid attendee status payload",
        details: parsed.error.flatten(),
      });
    }

    const attendee = await prisma.user.findFirst({
      where: {
        id,
        role: Role.ATTENDEE,
      },
      select: { id: true, isActive: true },
    });
    if (!attendee) {
      return fail(404, { code: "NOT_FOUND", message: "Attendee not found" });
    }

    const updated = await prisma.user.update({
      where: { id: attendee.id },
      data: { isActive: parsed.data.isActive },
      select: { id: true, isActive: true },
    });

    await writeAuditLog({
      actorUserId: auth.sub,
      action: updated.isActive ? "ATTENDEE_UNSUSPENDED" : "ATTENDEE_SUSPENDED",
      entityType: "User",
      entityId: updated.id,
      metadata: { previousIsActive: attendee.isActive, nextIsActive: updated.isActive },
    });

    return ok(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Admin access required" });
    }

    console.error("[app/api/admin/attendees/[id]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update attendee status" });
  }
}
