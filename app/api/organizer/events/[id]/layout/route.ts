import { NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { resolveEventSeating } from "@/src/lib/event-seating";
import { fail, ok } from "@/src/lib/http/response";
import { getEventLayoutDecision, syncEventLayoutMode } from "@/src/lib/services/ticket-class-layout";
import { getEventSeatingSectionSummaries } from "@/src/lib/services/event-seating-sections";
import { getTicketClassType } from "@/src/lib/ticket-classes";

import { venueUpdateSchema } from "@/src/lib/validators/organizer";
import { computeSeatingSummary } from "@/src/lib/validators/venue-seating";

type PersistedLayoutSection = {
  id: string;
  sectionType: string;
  capacity: number | null;
};

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
          classType: true,
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

function isCompatibleLayoutSection(classType: string, section: PersistedLayoutSection) {
  if (classType === "mixed") return section.sectionType === "ROWS" || section.sectionType === "TABLES";
  if (classType === "seating") return section.sectionType === "ROWS";
  if (classType === "table") return section.sectionType === "TABLES";
  return false;
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
    const seating = resolveEventSeating(event);
    console.log("8. resolveEventSeating SUCCESS.");

    const persistedSections = event.seatingPlan?.sections ?? [];
    const displaySections = persistedSections.length > 0
      ? persistedSections
      : (seating.seatingConfig
          ? getEventSeatingSectionSummaries(seating.seatingConfig).map((section) => ({
              id: section.key,
              key: section.key,
              name: section.name,
              sectionType: section.sectionType,
              capacity: section.capacity,
              sortOrder: section.sortOrder,
            }))
          : []);

    const sections = displaySections.map((section) => {
      const usedQuantity = event.ticketTypes
        .filter((ticketClass) => ticketClass.eventSeatingSectionId === section.id)
        .reduce((sum, ticketClass) => sum + ticketClass.quantity, 0);

      return {
        id: section.id,
        key: section.key,
        name: section.name,
        sectionType: section.sectionType,
        capacity: section.capacity,
        usedQuantity,
        remainingCapacity: section.capacity === null ? null : Math.max(0, section.capacity - usedQuantity),
      };
    });

    return ok({
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        venue: event.venue
          ? {
              id: event.venue.id,
              name: event.venue.name,
              addressLine1: event.venue.addressLine1,
              seatingConfig: event.venue.seatingConfig,
            }
          : null,
        seatingMode: event.seatingMode,
        ticketClasses: event.ticketTypes.map((ticketClass) => ({
          ...ticketClass,
          classType: getTicketClassType(ticketClass.classType),
        })),
      },
      layoutDecision,
      seating: {
        source: seating.source,
        seatingConfig: seating.seatingConfig,
        seatState: seating.seatState,
      },
      sections,
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
          data: getEventSeatingSectionSummaries(parsed.data.seatingConfig).map((section) => ({
            eventSeatingPlanId: plan.id,
            key: section.key,
            name: section.name,
            sectionType: section.sectionType,
            capacity: section.capacity,
            sortOrder: section.sortOrder,
          })),
        });
      }

      const sections = await tx.eventSeatingSection.findMany({
        where: { eventSeatingPlanId: plan.id },
        select: { id: true, sectionType: true, capacity: true },
        orderBy: { sortOrder: "asc" },
      });
      const ticketTypes = await tx.ticketType.findMany({
        where: { eventId: event.id, isActive: true },
        select: { id: true, classType: true, quantity: true, eventSeatingSectionId: true },
        orderBy: { sortOrder: "asc" },
      });
      const mappedSectionIds = new Set(ticketTypes.map((ticketType) => ticketType.eventSeatingSectionId).filter(Boolean));

      for (const ticketType of ticketTypes) {
        if (ticketType.eventSeatingSectionId) continue;

        const classType = getTicketClassType(ticketType.classType);
        if (classType === "general") continue;

        const compatibleSections = sections.filter((section) => isCompatibleLayoutSection(classType, section));
        const targetSection =
          compatibleSections
            .filter((section) => !mappedSectionIds.has(section.id))
            .sort((a, b) => (a.capacity ?? Number.MAX_SAFE_INTEGER) - (b.capacity ?? Number.MAX_SAFE_INTEGER))
            .find((section) => section.capacity === null || section.capacity >= ticketType.quantity) ??
          compatibleSections.find((section) => !mappedSectionIds.has(section.id));

        if (!targetSection) continue;

        mappedSectionIds.add(targetSection.id);
        await tx.ticketType.update({
          where: { id: ticketType.id },
          data: { eventSeatingSectionId: targetSection.id },
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
