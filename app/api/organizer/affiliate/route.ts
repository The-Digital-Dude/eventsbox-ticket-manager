import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { nanoid } from "nanoid";

const createAffiliateSchema = z.object({
  label: z.string().max(100).optional(),
  eventId: z.string().cuid().optional().nullable(),
  commissionPct: z.coerce.number().min(0).max(100).default(10),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, "Code must be 3-20 characters (A-Z, 0-9, _, -)").optional(),
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
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });

    const links = await prisma.affiliateLink.findMany({
      where: { organizerProfileId: profile.id },
      include: {
        _count: { select: { orders: true } },
        event: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(links);
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[GET /api/organizer/affiliate]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to load affiliate links" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });

    const parsed = createAffiliateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() });
    }

    if (parsed.data.eventId) {
      const ownedEvent = await prisma.event.findFirst({
        where: { id: parsed.data.eventId, organizerProfileId: profile.id },
        select: { id: true },
      });
      if (!ownedEvent) return fail(404, { code: "EVENT_NOT_FOUND", message: "Event not found" });
    }

    const code = parsed.data.code || nanoid(8).toUpperCase();
    
    const existing = await prisma.affiliateLink.findUnique({ where: { code } });
    if (existing) return fail(409, { code: "CODE_EXISTS", message: "Affiliate code already in use" });

    const link = await prisma.affiliateLink.create({
      data: {
        organizerProfileId: profile.id,
        code,
        label: parsed.data.label || null,
        commissionPct: parsed.data.commissionPct,
        eventId: parsed.data.eventId || null,
      },
      include: {
        _count: { select: { orders: true } },
        event: { select: { title: true, slug: true } },
      },
    });

    return ok(link, 201);
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[POST /api/organizer/affiliate]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to create affiliate link" });
  }
}
