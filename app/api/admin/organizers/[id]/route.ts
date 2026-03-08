import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
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

    const parsed = organizerPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid organizer patch payload", details: parsed.error.flatten() });
    }

    if (Object.keys(parsed.data).length === 0) {
      return fail(400, { code: "EMPTY_PATCH", message: "No editable fields provided" });
    }

    const row = await prisma.organizerProfile.update({
      where: { id },
      data: parsed.data,
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
