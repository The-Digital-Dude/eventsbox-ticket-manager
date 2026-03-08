import { DiscountType, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

const createPromoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4,20}$/, "Code must be 4-20 uppercase alphanumeric characters"),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.coerce.number().positive(),
  eventId: z.string().cuid().optional(),
  maxUses: z.coerce.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional().default(true),
}).superRefine((data, ctx) => {
  if (data.discountType === DiscountType.PERCENTAGE && data.discountValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discountValue"],
      message: "Percentage discount cannot exceed 100",
    });
  }
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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const promoCodes = await prisma.promoCode.findMany({
      where: { organizerProfileId: profile.id },
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
      orderBy: [{ createdAt: "desc" }],
    });

    return ok(promoCodes);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/organizer/promo-codes/route.ts][GET]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load promo codes" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const parsed = createPromoCodeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid promo code payload",
        details: parsed.error.flatten(),
      });
    }

    if (parsed.data.eventId) {
      const ownedEvent = await prisma.event.findFirst({
        where: { id: parsed.data.eventId, organizerProfileId: profile.id },
        select: { id: true },
      });
      if (!ownedEvent) {
        return fail(404, { code: "EVENT_NOT_FOUND", message: "Event not found for organizer" });
      }
    }

    const existing = await prisma.promoCode.findUnique({
      where: { code: parsed.data.code },
      select: { id: true },
    });
    if (existing) {
      return fail(409, { code: "PROMO_CODE_EXISTS", message: "Promo code already exists" });
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        organizerProfileId: profile.id,
        code: parsed.data.code,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
        maxUses: parsed.data.maxUses ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        isActive: parsed.data.isActive,
        ...(parsed.data.eventId ? { eventId: parsed.data.eventId } : {}),
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

    return ok(promoCode, 201);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/organizer/promo-codes/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to create promo code" });
  }
}
