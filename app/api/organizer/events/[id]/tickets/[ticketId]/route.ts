import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { getTicketClassType, serializeTicketClass } from "@/src/lib/ticket-classes";
import { syncEventLayoutMode, validateTicketClassLayoutMapping } from "@/src/lib/services/ticket-class-layout";
import { ticketTypeUpdateSchema } from "@/src/lib/validators/event";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; ticketId: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id, ticketId } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({ where: { id, organizerProfileId: profile.id } });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const ticket = await prisma.ticketType.findFirst({ where: { id: ticketId, eventId: id } });
    if (!ticket) return fail(404, { code: "NOT_FOUND", message: "Ticket type not found" });

    const parsed = ticketTypeUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid ticket data", details: parsed.error.flatten() });
    }

    const nextQuantity = parsed.data.quantity ?? ticket.quantity;
    const nextReservedQty = parsed.data.reservedQty ?? ticket.reservedQty;
    if (nextReservedQty > nextQuantity - ticket.sold) {
      return fail(400, {
        code: "INVALID_RESERVED_QTY",
        message: "Reserved quantity cannot exceed remaining inventory",
      });
    }
    if (nextReservedQty < ticket.compIssued) {
      return fail(400, {
        code: "INVALID_RESERVED_QTY",
        message: "Reserved quantity cannot be less than already issued comp tickets",
      });
    }

    const { saleStartAt, saleEndAt, classType, ...rest } = parsed.data;
    const currentClassType = getTicketClassType(ticket.inventoryMode);
    const nextClassType = classType ?? getTicketClassType(rest.inventoryMode ?? ticket.inventoryMode);
    const nextSectionId = rest.sectionId !== undefined ? rest.sectionId : ticket.sectionId;
    const nextEventSeatingSectionId =
      rest.eventSeatingSectionId !== undefined ? rest.eventSeatingSectionId : ticket.eventSeatingSectionId;
    const isClassTypeChange = nextClassType !== currentClassType;
    const isLayoutTargetChange =
      nextSectionId !== ticket.sectionId ||
      nextEventSeatingSectionId !== ticket.eventSeatingSectionId;

    if (nextQuantity < ticket.sold) {
      return fail(400, {
        code: "QUANTITY_BELOW_SOLD",
        message: "Quantity cannot be reduced below tickets already sold",
      });
    }

    await validateTicketClassLayoutMapping({
      eventId: id,
      classType: nextClassType,
      quantity: rest.quantity ?? ticket.quantity,
      excludeTicketTypeId: ticket.id,
      sectionId: nextSectionId,
      eventSeatingSectionId: nextEventSeatingSectionId,
    });

    if (isClassTypeChange && (ticket.eventSeatingSectionId || ticket.sectionId)) {
      return fail(400, {
        code: "CLASS_TYPE_CHANGE_REQUIRES_CLEAR_ASSIGNMENT",
        message: "Clear the current layout assignment before changing the ticket class type",
      });
    }

    if (ticket.sold > 0 && isClassTypeChange) {
      return fail(400, {
        code: "CLASS_TYPE_LOCKED_AFTER_SALES",
        message: "You cannot change the ticket class type after sales have started",
      });
    }

    if (ticket.sold > 0 && isLayoutTargetChange) {
      return fail(400, {
        code: "LAYOUT_TARGET_LOCKED_AFTER_SALES",
        message: "You cannot change the ticket class layout target after sales have started",
      });
    }

    const updated = await prisma.ticketType.update({
      where: { id: ticketId },
      data: {
        ...rest,
        ...(saleStartAt !== undefined ? { saleStartAt: saleStartAt ? new Date(saleStartAt) : null } : {}),
        ...(saleEndAt !== undefined ? { saleEndAt: saleEndAt ? new Date(saleEndAt) : null } : {}),
      },
    });

    await syncEventLayoutMode(id);

    return ok(serializeTicketClass(updated));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "GENERAL_CLASS_CANNOT_HAVE_LAYOUT_MAPPING") {
        return fail(400, { code: "GENERAL_CLASS_CANNOT_HAVE_LAYOUT_MAPPING", message: "General ticket classes cannot be mapped to seating or table structures" });
      }
      if (error.message === "EVENT_SECTION_NOT_FOUND" || error.message === "VENUE_SECTION_NOT_FOUND") {
        return fail(400, { code: "SECTION_NOT_FOUND", message: "Selected layout section was not found for this event" });
      }
      if (error.message === "SEATING_CLASS_REQUIRES_SEATING_SECTION") {
        return fail(400, { code: "INVALID_SECTION_MAPPING", message: "Seating ticket classes can only map to seating sections" });
      }
      if (error.message === "TABLE_CLASS_REQUIRES_TABLE_SECTION") {
        return fail(400, { code: "INVALID_SECTION_MAPPING", message: "Table ticket classes can only map to table sections" });
      }
      if (error.message === "SECTION_CAPACITY_EXCEEDED") {
        return fail(400, { code: "SECTION_CAPACITY_EXCEEDED", message: "Ticket class quantity exceeds the available capacity of the selected section" });
      }
    }
    console.error("[app/api/organizer/events/[id]/tickets/[ticketId]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to update ticket class" });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; ticketId: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id, ticketId } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({ where: { id, organizerProfileId: profile.id } });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const ticket = await prisma.ticketType.findFirst({ where: { id: ticketId, eventId: id } });
    if (!ticket) return fail(404, { code: "NOT_FOUND", message: "Ticket type not found" });

    if (ticket.sold > 0) {
      return fail(400, { code: "HAS_SALES", message: "Cannot delete a ticket type with existing sales" });
    }

    await prisma.ticketType.delete({ where: { id: ticketId } });
    await syncEventLayoutMode(id);
    return ok({ deleted: true });
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/tickets/[ticketId]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to delete ticket class" });
  }
}
