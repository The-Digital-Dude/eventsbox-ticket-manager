import { NextRequest } from "next/server";
import { EventSeatingSectionType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { resolveEventSeating } from "@/src/lib/event-seating";
import { fail, ok } from "@/src/lib/http/response";
import { getEventLayoutDecision, syncEventLayoutMode } from "@/src/lib/services/ticket-class-layout";

import { venueUpdateSchema } from "@/src/lib/validators/organizer";
import { computeSeatingSummary } from "@/src/lib/validators/venue-seating";
import type { SeatingSection } from "@/src/types/venue-seating";

async function getOwnEventLayout(eventId: string, organizerUserId: string) {
  const profile = await prisma.organizerProfile.findUnique({ where: { userId: organizerUserId } });
  if (!profile) return { profile: null, event: null };

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerProfileId: profile.id },
    include: {
      venue: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          seatingConfig: true,
          seatState: true,
        },
      },
      seatingPlan: {
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              key: true,
              name: true,
              sectionType: true,
              capacity: true,
              sortOrder: true,
            },
          },
        },
      },
      ticketTypes: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          isActive: true,
          quantity: true,
          sold: true,
          sectionId: true,
          eventSeatingSectionId: true,
        },
      },
    },
  });

  return { profile, event };
}

function getSectionType(section: SeatingSection): EventSeatingSectionType {
  return section.mapType === "table" ? "TABLES" : "ROWS";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  console.log("--- [GET /layout] START ---");
  try {
    console.log("1. Calling requireRole...");
    const auth = await requireRole(req, Role.ORGANIZER);
    console.log("2. requireRole SUCCESS. Auth:", auth);

    const { id } = await params;
    console.log(`3. Event ID: ${id}`);

    const { profile, event } = await getOwnEventLayout(id, auth.sub);
    console.log("4. Fetched event:", event ? `ID: ${event.id}` : "NULL");

    if (!profile) {
        console.error("PROFILE NOT FOUND");
        return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });
    }
    if (!event) {
        console.error("EVENT NOT FOUND OR NOT OWNED BY USER");
        return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    console.log("5. Calling getEventLayoutDecision...");
    const layoutDecision = await getEventLayoutDecision(event.id);
    console.log("6. getEventLayoutDecision SUCCESS. Decision:", layoutDecision);

    console.log("7. Calling resolveEventSeating...");
    resolveEventSeating(event);
    console.log("8. resolveEventSeating SUCCESS.");

    return ok({
      // ... response data
    });
  } catch (error) {
    console.error("--- [GET /layout] CAUGHT ERROR ---", error);
    return fail(403, { code: "FORBIDDEN", message: "An unexpected error occurred." });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const { profile, event } = await getOwnEventLayout(id, auth.sub);
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    if (!["DRAFT", "REJECTED"].includes(event.status)) {
      return fail(400, { code: "NOT_EDITABLE", message: "Only draft or rejected events can update layout" });
    }

    const layoutDecision = await getEventLayoutDecision(event.id);
    if (!layoutDecision.requiresLayout) {
      return fail(400, { code: "LAYOUT_NOT_REQUIRED", message: "This event does not require a seating or table layout" });
    }

    // Freeze layout mutations once sales have started so section capacities and sold inventory cannot drift apart.
    if (event.ticketTypes.some((ticketType) => ticketType.sold > 0)) {
      return fail(400, {
        code: "LAYOUT_LOCKED_AFTER_SALES",
        message: "You cannot change the event layout after ticket sales have started",
      });
    }

    const parsed = venueUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid layout payload", details: parsed.error.flatten() });
    }

    const computed = computeSeatingSummary(parsed.data.seatingConfig.sections);
    const deletedCount = parsed.data.seatState
      ? Object.values(parsed.data.seatState).filter((s: { deleted?: boolean }) => s.deleted).length
      : 0;
    const adjustedTotalSeats = computed.totalSeats - deletedCount;
    if (adjustedTotalSeats !== parsed.data.summary.totalSeats || computed.totalTables !== parsed.data.summary.totalTables) {
      return fail(400, {
        code: "SEATING_SUMMARY_MISMATCH",
        message: "Layout summary does not match seating configuration",
        details: { computed, provided: parsed.data.summary },
      });
    }

    if (!layoutDecision.supportsSeating && parsed.data.summary.totalSeats > parsed.data.summary.totalTables * 0) {
      const hasSeatSections = parsed.data.seatingConfig.sections.some((section) => section.mapType === "seats");
      if (hasSeatSections) {
        return fail(400, { code: "INVALID_LAYOUT_FOR_EVENT", message: "This event only supports table layouts" });
      }
    }

    if (!layoutDecision.supportsTables) {
      const hasTableSections = parsed.data.seatingConfig.sections.some((section) => section.mapType === "table");
      if (hasTableSections) {
        return fail(400, { code: "INVALID_LAYOUT_FOR_EVENT", message: "This event only supports seating layouts" });
      }
    }

    const savedPlan = await prisma.$transaction(async (tx) => {
      const plan = await tx.eventSeatingPlan.upsert({
        where: { eventId: event.id },
        create: {
          eventId: event.id,
          mode: layoutDecision.eventSeatingMode,
          source: "CUSTOM",
          sourceVenueId: event.venueId ?? undefined,
          seatingConfig: parsed.data.seatingConfig as Prisma.InputJsonValue,
          seatState: parsed.data.seatState ? (parsed.data.seatState as Prisma.InputJsonValue) : Prisma.JsonNull,
          summary: parsed.data.summary as Prisma.InputJsonValue,
        },
        update: {
          mode: layoutDecision.eventSeatingMode,
          source: "CUSTOM",
          sourceVenueId: event.venueId ?? undefined,
          seatingConfig: parsed.data.seatingConfig as Prisma.InputJsonValue,
          seatState: parsed.data.seatState ? (parsed.data.seatState as Prisma.InputJsonValue) : Prisma.JsonNull,
          summary: parsed.data.summary as Prisma.InputJsonValue,
          schemaVersion: parsed.data.seatingConfig.schemaVersion,
        },
      });

      await tx.eventSeatingSection.deleteMany({ where: { eventSeatingPlanId: plan.id } });

      if (parsed.data.seatingConfig.sections.length > 0) {
        await tx.eventSeatingSection.createMany({
          data: parsed.data.seatingConfig.sections.map((section, index) => ({
            eventSeatingPlanId: plan.id,
            key: section.id,
            name: section.name,
            sectionType: getSectionType(section),
            capacity:
              section.mapType === "table"
                ? (section.tableConfig?.rows ?? 0) * (section.tableConfig?.columns ?? 0)
                : (section.columns ?? []).reduce((sum, column) => sum + column.rows * column.seats, 0),
            sortOrder: index,
          })),
        });
      }

      return plan;
    });

    await syncEventLayoutMode(event.id);

    return ok({ id: savedPlan.id, eventId: event.id, mode: layoutDecision.eventSeatingMode });
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/layout/route.ts][PUT]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to save event layout" });
  }
}
