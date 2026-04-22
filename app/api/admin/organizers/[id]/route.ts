import { NextRequest } from "next/server";
import { OrganizerApprovalStatus, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

const organizerDetailInclude = {
  user: { select: { id: true, email: true, emailVerified: true, isActive: true } },
  payoutSettings: true,
  venues: { include: { state: true, city: true, category: true } },
} as const;

const organizerPatchSchema = z
  .object({
    companyName: z.string().max(500).optional(),
    brandName: z.string().max(500).optional(),
    website: z.string().max(500).optional(),
    taxId: z.string().max(500).optional(),
    contactName: z.string().max(500).optional(),
    phone: z.string().max(500).optional(),
    alternatePhone: z.string().max(500).optional(),
    supportEmail: z.string().max(500).optional(),
    addressLine1: z.string().max(500).optional(),
    addressLine2: z.string().max(500).optional(),
    facebookPage: z.string().max(500).optional(),
    socialMediaLink: z.string().max(500).optional(),
  })
  .strict();

const organizerApprovalSchema = z.object({
  approvalStatus: z.nativeEnum(OrganizerApprovalStatus).refine(val => val !== OrganizerApprovalStatus.DRAFT, { message: "Cannot set status to DRAFT" }),
  rejectionReason: z.string().max(1000).optional().nullable(),
}).strict().refine(data => {
  if (data.approvalStatus === OrganizerApprovalStatus.REJECTED && !data.rejectionReason) {
    return false;
  }
  return true;
}, { message: "Rejection reason is required when status is REJECTED", path: ["rejectionReason"] });


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;

    const row = await prisma.organizerProfile.findUnique({
      where: { id },
      include: organizerDetailInclude,
    });

    if (!row) {
      return fail(404, { code: "NOT_FOUND", message: "Organizer not found" });
    }

    const [state, city] = await Promise.all([
      row.stateId ? prisma.state.findUnique({ where: { id: row.stateId }, select: { id: true, name: true } }) : Promise.resolve(null),
      row.cityId ? prisma.city.findUnique({ where: { id: row.cityId }, select: { id: true, name: true } }) : Promise.resolve(null),
    ]);

    return ok({ ...row, state, city });
  } catch (error) {
    console.error("[app/api/admin/organizers/[id]/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Admin only" });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { id } = await params;

    const body = await req.json();

    // Try parsing as approval action first
    const approvalParsed = organizerApprovalSchema.safeParse(body);

    if (approvalParsed.success) {
      const { approvalStatus, rejectionReason } = approvalParsed.data;
      const updateData: { approvalStatus: OrganizerApprovalStatus, rejectionReason?: string | null, approvedAt?: Date | null } = {
        approvalStatus,
        rejectionReason: rejectionReason ?? null,
      };

      if (approvalStatus === OrganizerApprovalStatus.APPROVED) {
        updateData.approvedAt = new Date();
      } else if (approvalStatus === OrganizerApprovalStatus.PENDING_APPROVAL || approvalStatus === OrganizerApprovalStatus.REJECTED || approvalStatus === OrganizerApprovalStatus.SUSPENDED) {
        updateData.approvedAt = null; // Clear approvedAt if status is not APPROVED
      }

      const updatedProfile = await prisma.organizerProfile.update({
        where: { id },
        data: updateData,
        include: organizerDetailInclude,
      });

      // Also update the associated User role if approved
      if (approvalStatus === OrganizerApprovalStatus.APPROVED) {
        await prisma.user.update({
          where: { id: updatedProfile.userId },
          data: { role: Role.ORGANIZER },
        });
      } else if (approvalStatus === OrganizerApprovalStatus.SUSPENDED) {
        // Optionally downgrade user role if suspended
        await prisma.user.update({
          where: { id: updatedProfile.userId },
          data: { role: Role.ATTENDEE }, // Downgrade to ATTENDEE
        });
      }

      const [state, city] = await Promise.all([
        updatedProfile.stateId ? prisma.state.findUnique({ where: { id: updatedProfile.stateId }, select: { id: true, name: true } }) : Promise.resolve(null),
        updatedProfile.cityId ? prisma.city.findUnique({ where: { id: updatedProfile.cityId }, select: { id: true, name: true } }) : Promise.resolve(null),
      ]);

      return ok({ ...updatedProfile, state, city });
    }

    // If not an approval action, try parsing as a general profile update
    const profileParsed = organizerPatchSchema.safeParse(body);
    if (!profileParsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid organizer patch payload", details: profileParsed.error.flatten() });
    }

    if (Object.keys(profileParsed.data).length === 0) {
      return fail(400, { code: "EMPTY_PATCH", message: "No editable fields provided" });
    }

    const row = await prisma.organizerProfile.update({
      where: { id },
      data: profileParsed.data,
      include: organizerDetailInclude,
    });

    const [state, city] = await Promise.all([
      row.stateId ? prisma.state.findUnique({ where: { id: row.stateId }, select: { id: true, name: true } }) : Promise.resolve(null),
      row.cityId ? prisma.city.findUnique({ where: { id: row.cityId }, select: { id: true, name: true } }) : Promise.resolve(null),
    ]);

    return ok({ ...row, state, city });
  } catch (error) {
    console.error("[app/api/admin/organizers/[id]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update organizer profile" });
  }
}
