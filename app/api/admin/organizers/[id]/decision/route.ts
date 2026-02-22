import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { organizerDecisionSchema } from "@/src/lib/validators/admin";
import { writeAuditLog } from "@/src/lib/services/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;
    const parsed = organizerDecisionSchema.safeParse(await req.json());

    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid decision payload" });
    }

    const updated = await prisma.organizerProfile.update({
      where: { id },
      data: {
        approvalStatus: parsed.data.action,
        rejectionReason: parsed.data.action === "REJECTED" ? parsed.data.reason ?? "No reason provided" : null,
        approvedAt: parsed.data.action === "APPROVED" ? new Date() : null,
      },
    });

    await writeAuditLog({
      actorUserId: actor.sub,
      action: `ORGANIZER_${parsed.data.action}`,
      entityType: "OrganizerProfile",
      entityId: updated.id,
      metadata: { reason: parsed.data.reason ?? null },
    });

    return ok(updated);
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to apply decision" });
  }
}
