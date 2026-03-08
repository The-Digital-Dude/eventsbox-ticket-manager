import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

const patchPromoCodeSchema = z.object({
  isActive: z.boolean().optional(),
  maxUses: z.coerce.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
}).refine((data) => data.isActive !== undefined || data.maxUses !== undefined || data.expiresAt !== undefined, {
  message: "At least one editable field must be provided",
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

async function findOwnedPromoCode(id: string, userId: string) {
  return prisma.promoCode.findFirst({
    where: {
      id,
      organizerProfile: { userId },
    },
    select: { id: true },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;

    const promoCode = await findOwnedPromoCode(id, auth.sub);
    if (!promoCode) {
      return fail(404, { code: "NOT_FOUND", message: "Promo code not found" });
    }

    const parsed = patchPromoCodeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid promo code update payload",
        details: parsed.error.flatten(),
      });
    }

    const updated = await prisma.promoCode.update({
      where: { id: promoCode.id },
      data: {
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.maxUses !== undefined ? { maxUses: parsed.data.maxUses } : {}),
        ...(parsed.data.expiresAt !== undefined
          ? { expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null }
          : {}),
      },
      select: {
        id: true,
        code: true,
        discountType: true,
        discountValue: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        isActive: true,
        eventId: true,
      },
    });

    return ok(updated);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/organizer/promo-codes/[id]/route.ts][PATCH]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update promo code" });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;

    const promoCode = await findOwnedPromoCode(id, auth.sub);
    if (!promoCode) {
      return fail(404, { code: "NOT_FOUND", message: "Promo code not found" });
    }

    await prisma.promoCode.update({
      where: { id: promoCode.id },
      data: { isActive: false },
    });

    return ok({ deleted: true, isActive: false });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/organizer/promo-codes/[id]/route.ts][DELETE]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to deactivate promo code" });
  }
}
