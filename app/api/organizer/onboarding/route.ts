import { NextRequest } from "next/server";
import { OrganizerApprovalStatus, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { requireRole } from "@/src/lib/auth/guards";
import { organizerOnboardingSchema } from "@/src/lib/validators/organizer";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    return ok(profile);
  } catch {
    return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const parsed = organizerOnboardingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid onboarding data", details: parsed.error.flatten() });
    }

    const { submit, ...payload } = parsed.data;
    const nextStatus = submit ? OrganizerApprovalStatus.PENDING_APPROVAL : OrganizerApprovalStatus.DRAFT;
    const profile = await prisma.organizerProfile.update({
      where: { userId: auth.sub },
      data: {
        ...payload,
        approvalStatus: nextStatus,
        rejectionReason: submit ? null : undefined,
        submittedAt: submit ? new Date() : undefined,
        onboardingDoneAt: new Date(),
      },
    });

    return ok(profile);
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to save onboarding" });
  }
}
