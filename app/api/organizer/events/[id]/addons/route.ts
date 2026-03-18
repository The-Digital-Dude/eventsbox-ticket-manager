import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

const createAddOnSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  price: z.coerce.number().min(0),
  maxPerOrder: z.coerce.number().int().min(1).default(10),
  totalStock: z.coerce.number().int().min(1).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().optional().default(0),
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

export async function GET(
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
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
    });
    if (!event) return fail(404, { code: "EVENT_NOT_FOUND", message: "Event not found" });

    const addOns = await prisma.eventAddOn.findMany({
      where: { eventId: id },
      orderBy: { sortOrder: "asc" },
    });

    return ok(addOns);
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[GET /api/organizer/events/[id]/addons]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to load add-ons" });
  }
}

export async function POST(
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
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
    });
    if (!event) return fail(404, { code: "EVENT_NOT_FOUND", message: "Event not found" });

    const parsed = createAddOnSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() });
    }

    const addOn = await prisma.eventAddOn.create({
      data: {
        eventId: id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        price: parsed.data.price,
        maxPerOrder: parsed.data.maxPerOrder,
        totalStock: parsed.data.totalStock || null,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
      },
    });

    return ok(addOn, 201);
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    console.error("[POST /api/organizer/events/[id]/addons]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to create add-on" });
  }
}
