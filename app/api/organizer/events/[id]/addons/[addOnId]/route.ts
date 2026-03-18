import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

const updateAddOnSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  price: z.coerce.number().min(0).optional(),
  maxPerOrder: z.coerce.number().int().min(1).optional(),
  totalStock: z.coerce.number().int().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
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
  { params }: { params: Promise<{ id: string; addOnId: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id, addOnId } = await params;

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
    });
    if (!event) return fail(404, { code: "EVENT_NOT_FOUND", message: "Event not found" });

    const existing = await prisma.eventAddOn.findFirst({
      where: { id: addOnId, eventId: id },
    });
    if (!existing) return fail(404, { code: "NOT_FOUND", message: "Add-on not found" });

    const parsed = updateAddOnSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() });
    }

    const addOn = await prisma.eventAddOn.update({
      where: { id: addOnId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
        ...(parsed.data.maxPerOrder !== undefined ? { maxPerOrder: parsed.data.maxPerOrder } : {}),
        ...(parsed.data.totalStock !== undefined ? { totalStock: parsed.data.totalStock } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
      },
    });

    return ok(addOn);
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[PATCH /api/organizer/events/[id]/addons/[addOnId]]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to update add-on" });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; addOnId: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id, addOnId } = await params;

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
    });
    if (!event) return fail(404, { code: "EVENT_NOT_FOUND", message: "Event not found" });

    const existing = await prisma.eventAddOn.findFirst({
      where: { id: addOnId, eventId: id },
    });
    if (!existing) return fail(404, { code: "NOT_FOUND", message: "Add-on not found" });

    const orderCount = await prisma.orderAddOn.count({
      where: { addOnId },
    });

    if (orderCount > 0) {
      await prisma.eventAddOn.update({
        where: { id: addOnId },
        data: { isActive: false },
      });
      return ok({ deleted: false, deactivated: true });
    }

    await prisma.eventAddOn.delete({
      where: { id: addOnId },
    });

    return ok({ deleted: true, deactivated: false });
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[DELETE /api/organizer/events/[id]/addons/[addOnId]]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to delete add-on" });
  }
}
