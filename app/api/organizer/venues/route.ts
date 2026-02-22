import { NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { venueRequestSchema } from "@/src/lib/validators/organizer";
import { computeSeatingSummary } from "@/src/lib/validators/venue-seating";

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

    const computed = computeSeatingSummary(parsed.data.seatingConfig.sections);
    if (computed.totalSeats !== parsed.data.summary.totalSeats || computed.totalTables !== parsed.data.summary.totalTables) {
      return fail(400, {
        code: "SEATING_SUMMARY_MISMATCH",
        message: "Seating summary does not match seating configuration",
        details: { computed, provided: parsed.data.summary },
      });
    }

    const venue = await prisma.venue.create({
      data: {
        organizerProfileId: profile.id,
        name: parsed.data.name,
        addressLine1: parsed.data.addressLine1,
        addressLine2: parsed.data.addressLine2,
        stateId: parsed.data.stateId,
        cityId: parsed.data.cityId,
        categoryId: parsed.data.categoryId,
        seatingConfig: parsed.data.seatingConfig as Prisma.InputJsonValue,
        seatState: parsed.data.seatState ? (parsed.data.seatState as Prisma.InputJsonValue) : undefined,
        seatingSchemaVersion: parsed.data.seatingConfig.schemaVersion,
        seatingUpdatedAt: new Date(),
        totalSeats: parsed.data.summary.totalSeats,
        totalTables: parsed.data.summary.totalTables,
      },
    });

    return ok(venue, 201);
  } catch (error) {
    return fail(500, {
      code: "INTERNAL_ERROR",
      message: "Unable to create venue request",
      details: process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
}
