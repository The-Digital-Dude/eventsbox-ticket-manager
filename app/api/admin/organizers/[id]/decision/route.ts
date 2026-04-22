import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { organizerDecisionSchema } from "@/src/lib/validators/admin";
import { writeAuditLog } from "@/src/lib/services/audit";
import {
  sendOrganizerApprovedEmail,
  sendOrganizerRejectedEmail,
} from "@/src/lib/services/notifications";
import { getCommunicationSettings } from "@/src/lib/services/platform-settings";

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

    const organizerUser = await prisma.user.findUnique({
      where: { id: updated.userId },
      select: { email: true },
    });
    const communicationSettings = await getCommunicationSettings();

    if (
      organizerUser &&
      communicationSettings.emailNotificationsEnabled &&
      communicationSettings.organizerApprovalEmailEnabled
    ) {
      const organizerName = organizerUser.email;
      if (parsed.data.action === "APPROVED") {
        void sendOrganizerApprovedEmail({
          to: organizerUser.email,
          organizerName,
        }).catch((error) => {
          console.error("[admin organizer decision][approved email]", error);
        });
      } else if (parsed.data.action === "REJECTED") {
        void sendOrganizerRejectedEmail({
          to: organizerUser.email,
          organizerName,
          reason: parsed.data.reason ?? "No reason provided",
        }).catch((error) => {
          console.error("[admin organizer decision][rejected email]", error);
        });
      }
    }

    await writeAuditLog({
      actorUserId: actor.sub,
      action: `ORGANIZER_${parsed.data.action}`,
      entityType: "OrganizerProfile",
      entityId: updated.id,
      metadata: { reason: parsed.data.reason ?? null },
    });

    return ok(updated);
  } catch (error) {
    console.error("[app/api/admin/organizers/[id]/decision/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to apply decision" });
  }
}
