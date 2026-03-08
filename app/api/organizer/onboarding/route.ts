import { NextRequest } from "next/server";
import { OrganizerApprovalStatus, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { requireRole } from "@/src/lib/auth/guards";
import { organizerOnboardingSchema } from "@/src/lib/validators/organizer";

function toDbOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "N/A";
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    return ok(profile);
  } catch (error) {
    console.error("[app/api/organizer/onboarding/route.ts]", error);
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
        companyName: payload.companyName.trim(),
        brandName: toDbOptional(payload.brandName),
        website: toDbOptional(payload.website),
        phone: payload.phone.trim(),
        alternatePhone: toDbOptional(payload.alternatePhone),
        supportEmail: toDbOptional(payload.supportEmail),
        facebookPage: toDbOptional(payload.facebookPage),
        socialMediaLink: toDbOptional(payload.socialMediaLink),
        contactName: payload.contactName.trim(),
        taxId: toDbOptional(payload.taxId),
        addressLine1: payload.addressLine1.trim(),
        addressLine2: toDbOptional(payload.addressLine2),
        stateId: payload.stateId || undefined,
        cityId: payload.cityId || undefined,
        approvalStatus: nextStatus,
        rejectionReason: submit ? null : undefined,
        submittedAt: submit ? new Date() : undefined,
        onboardingDoneAt: new Date(),
      },
    });

    return ok(profile);
  } catch (error) {
    console.error("[app/api/organizer/onboarding/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to save onboarding" });
  }
}
