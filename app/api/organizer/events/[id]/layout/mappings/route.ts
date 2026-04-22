import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { validateTicketClassAssignments } from "@/src/lib/services/ticket-class-layout";

const ticketClassAssignmentSchema = z.object({
  ticketTypeId: z.string().cuid(),
  eventSeatingSectionId: z.string().min(1).nullable(),
});

const ticketClassAssignmentsSchema = z.object({
  assignments: z.array(ticketClassAssignmentSchema),
});

async function getSectionLookup(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      seatingPlan: {
        include: {
          sections: true,
        },
      },
    },
  });

  const plan = event?.seatingPlan;
  if (!plan) {
    return { byId: new Map<string, string>(), byKey: new Map<string, string>() };
  }

  const sections = await prisma.eventSeatingSection.findMany({
    where: { eventSeatingPlanId: plan.id },
    select: { id: true, key: true },
  });

  return {
    byId: new Map(sections.map((section) => [section.id, section.id])),
    byKey: new Map(sections.map((section) => [section.key, section.id])),
  };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({ where: { id, organizerProfileId: profile.id } });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const parsed = ticketClassAssignmentsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid mapping payload", details: parsed.error.flatten() });
    }

    const sectionLookup = await getSectionLookup(id);
    const assignments = parsed.data.assignments.map((assignment) => ({
      ticketTypeId: assignment.ticketTypeId,
      eventSeatingSectionId: assignment.eventSeatingSectionId
        ? sectionLookup.byId.get(assignment.eventSeatingSectionId) ??
          sectionLookup.byKey.get(assignment.eventSeatingSectionId) ??
          assignment.eventSeatingSectionId
        : null,
    }));

    const validated = await validateTicketClassAssignments({
      eventId: id,
      assignments,
    });

    await prisma.$transaction(
      validated.assignments.map((assignment) =>
        prisma.ticketType.update({
          where: { id: assignment.ticketTypeId },
          data: {
            eventSeatingSectionId: assignment.eventSeatingSectionId,
          },
        }),
      ),
    );

    return ok({ updated: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "EVENT_SECTION_NOT_FOUND") {
        return fail(400, { code: "SECTION_NOT_FOUND", message: "Selected layout section was not found for this event" });
      }
      if (error.message === "TICKET_CLASS_NOT_FOUND") {
        return fail(400, { code: "TICKET_CLASS_NOT_FOUND", message: "Ticket class was not found for this event" });
      }
      if (error.message === "SEATING_CLASS_REQUIRES_SEATING_SECTION") {
        return fail(400, { code: "INVALID_SECTION_MAPPING", message: "Seating ticket classes can only map to seating sections" });
      }
      if (error.message === "TABLE_CLASS_REQUIRES_TABLE_SECTION") {
        return fail(400, { code: "INVALID_SECTION_MAPPING", message: "Table ticket classes can only map to table sections" });
      }
      if (error.message === "GENERAL_CLASS_CANNOT_HAVE_LAYOUT_MAPPING") {
        return fail(400, { code: "GENERAL_CLASS_CANNOT_HAVE_LAYOUT_MAPPING", message: "General ticket classes cannot be mapped to seating or table structures" });
      }
      if (error.message === "SECTION_CAPACITY_EXCEEDED") {
        return fail(400, { code: "SECTION_CAPACITY_EXCEEDED", message: "Mapped ticket quantities exceed the available section capacity" });
      }
      if (error.message === "MAPPING_LOCKED_AFTER_SALES") {
        return fail(400, { code: "MAPPING_LOCKED_AFTER_SALES", message: "You cannot change ticket class layout targets after sales have started" });
      }
    }

    console.error("[app/api/organizer/events/[id]/layout/mappings/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to save ticket class mappings" });
  }
}
