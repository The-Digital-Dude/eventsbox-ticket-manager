import { NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { venueUpdateSchema } from "@/src/lib/validators/organizer";
import { computeSeatingSummary } from "@/src/lib/validators/venue-seating";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;

    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const venue = await prisma.venue.findFirst({ where: { id, organizerProfileId: profile.id } });
    if (!venue) {
      return fail(404, { code: "VENUE_NOT_FOUND", message: "Venue not found" });
    }

    const parsed = venueUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid seating payload", details: parsed.error.flatten() });
    }

    const computed = computeSeatingSummary(parsed.data.seatingConfig.sections);
    if (computed.totalSeats !== parsed.data.summary.totalSeats || computed.totalTables !== parsed.data.summary.totalTables) {
      return fail(400, {
        code: "SEATING_SUMMARY_MISMATCH",
        message: "Seating summary does not match seating configuration",
        details: { computed, provided: parsed.data.summary },
      });
    }

    const updated = await prisma.venue.update({
      where: { id: venue.id },
      data: {
        seatingConfig: parsed.data.seatingConfig as Prisma.InputJsonValue,
        seatState: parsed.data.seatState ? (parsed.data.seatState as Prisma.InputJsonValue) : undefined,
        seatingSchemaVersion: parsed.data.seatingConfig.schemaVersion,
        seatingUpdatedAt: new Date(),
        totalSeats: parsed.data.summary.totalSeats,
        totalTables: parsed.data.summary.totalTables,
      },
    });

    return ok(updated);
  } catch (error) {
    console.error("[app/api/organizer/venues/[id]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update venue seating" });
  }
}
