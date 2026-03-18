import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

const updateAffiliateSchema = z.object({
  label: z.string().max(100).optional().nullable(),
  commissionPct: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

function authErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });

    const existing = await prisma.affiliateLink.findFirst({
      where: { id, organizerProfileId: profile.id },
    });
    if (!existing) return fail(404, { code: "NOT_FOUND", message: "Affiliate link not found" });

    const parsed = updateAffiliateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() });
    }

    const updated = await prisma.affiliateLink.update({
      where: { id },
      data: {
        ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
        ...(parsed.data.commissionPct !== undefined ? { commissionPct: parsed.data.commissionPct } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
      include: {
        _count: { select: { orders: true } },
        event: { select: { title: true, slug: true } },
      },
    });

    return ok(updated);
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[PATCH /api/organizer/affiliate/[id]]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to update affiliate link" });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });

    const existing = await prisma.affiliateLink.findFirst({
      where: { id, organizerProfileId: profile.id },
    });
    if (!existing) return fail(404, { code: "NOT_FOUND", message: "Affiliate link not found" });

    await prisma.affiliateLink.update({
      where: { id },
      data: { isActive: false },
    });

    return ok({ deleted: true });
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[DELETE /api/organizer/affiliate/[id]]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to delete affiliate link" });
  }
}
