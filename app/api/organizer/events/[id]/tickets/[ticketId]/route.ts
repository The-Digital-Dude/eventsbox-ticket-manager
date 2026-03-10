import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";
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

    const { saleStartAt, saleEndAt, ...rest } = parsed.data;

    const updated = await prisma.ticketType.update({
      where: { id: ticketId },
      data: {
        ...rest,
        ...(saleStartAt !== undefined ? { saleStartAt: saleStartAt ? new Date(saleStartAt) : null } : {}),
        ...(saleEndAt !== undefined ? { saleEndAt: saleEndAt ? new Date(saleEndAt) : null } : {}),
      },
    });

    return ok(updated);
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/tickets/[ticketId]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to update ticket type" });
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
    return ok({ deleted: true });
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/tickets/[ticketId]/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to delete ticket type" });
  }
}
