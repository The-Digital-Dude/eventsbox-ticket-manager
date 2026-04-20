import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
import { getTicketClassType, serializeTicketClass, serializeTicketClasses } from "@/src/lib/ticket-classes";
import { syncEventLayoutMode, validateTicketClassLayoutMapping } from "@/src/lib/services/ticket-class-layout";
import { ticketTypeCreateSchema } from "@/src/lib/validators/event";

async function getOwnEvent(id: string, organizerProfileId: string) {
  return prisma.event.findFirst({ where: { id, organizerProfileId } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await getOwnEvent(id, profile.id);
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const tickets = await prisma.ticketType.findMany({
      where: { eventId: id },
      orderBy: { sortOrder: "asc" },
    });

    return ok(serializeTicketClasses(tickets));
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/tickets/route.ts]", error);
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const event = await getOwnEvent(id, profile.id);
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    if (!["DRAFT", "REJECTED"].includes(event.status)) {
      return fail(400, { code: "NOT_EDITABLE", message: "Cannot add tickets to a non-draft event" });
    }

    const parsed = ticketTypeCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid ticket data", details: parsed.error.flatten() });
    }

    const { saleStartAt, saleEndAt, classType, ...rest } = parsed.data;

    await validateTicketClassLayoutMapping({
      eventId: id,
      classType: classType ?? getTicketClassType(rest.inventoryMode),
      quantity: rest.quantity,
      sectionId: rest.sectionId,
      eventSeatingSectionId: rest.eventSeatingSectionId,
    });

    const ticket = await prisma.ticketType.create({
      data: {
        ...rest,
        eventId: id,
        price: rest.price,
        ...(saleStartAt ? { saleStartAt: new Date(saleStartAt) } : {}),
        ...(saleEndAt ? { saleEndAt: new Date(saleEndAt) } : {}),
      },
    });

    await syncEventLayoutMode(id);

    return ok(serializeTicketClass(ticket), 201);
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
    console.error("[app/api/organizer/events/[id]/tickets/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to create ticket class" });
  }
}
