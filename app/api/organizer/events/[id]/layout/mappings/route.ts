import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { validateTicketClassAssignments } from "@/src/lib/services/ticket-class-layout";

const ticketClassAssignmentSchema = z.object({
  ticketTypeId: z.string().cuid(),
  eventSeatingSectionId: z.string().cuid().nullable(),
});

const ticketClassAssignmentsSchema = z.object({
  assignments: z.array(ticketClassAssignmentSchema),
});

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

    const validated = await validateTicketClassAssignments({
      eventId: id,
      assignments: parsed.data.assignments,
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
