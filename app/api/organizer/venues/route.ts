import { NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { resolveLocationIds } from "@/src/lib/location-resolution";
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
      include: { state: true, city: true, category: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(venues);
  } catch (error) {
    console.error("[app/api/organizer/venues/route.ts]", error);
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

    const { stateId, cityId } = await resolveLocationIds(parsed.data);
    if (!stateId || !cityId) {
      return fail(400, { code: "LOCATION_REQUIRED", message: "State and city are required" });
    }

    const venue = await prisma.venue.create({
      data: {
        organizerProfileId: profile.id,
        name: parsed.data.name,
        addressLine1: parsed.data.addressLine1,
        addressLine2: parsed.data.addressLine2,
        countryId: parsed.data.countryId,
        stateId,
        cityId,
        categoryId: parsed.data.categoryId,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
      },
    });

    return ok(venue, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "CITY_REQUIRES_STATE") {
      return fail(400, { code: "CITY_REQUIRES_STATE", message: "Enter or select a state before the city" });
    }
    return fail(500, {
      code: "INTERNAL_ERROR",
      message: "Unable to create venue request",
      details: process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
}
