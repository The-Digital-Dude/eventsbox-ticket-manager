import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { venueRequestSchema } from "@/src/lib/validators/organizer";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const venues = await prisma.venue.findMany({
      where: { organizerProfileId: profile.id },
      include: { state: true, city: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(venues);
  } catch {
    return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const parsed = venueRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid venue data", details: parsed.error.flatten() });
    }

    const venue = await prisma.venue.create({
      data: {
        organizerProfileId: profile.id,
        ...parsed.data,
      },
    });

    return ok(venue, 201);
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to create venue request" });
  }
}
