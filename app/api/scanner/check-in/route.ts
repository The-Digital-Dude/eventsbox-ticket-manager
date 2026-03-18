import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { requireScanner } from "@/src/lib/auth/guards";

export async function POST(req: NextRequest) {
  try {
    const { profile: scanner } = await requireScanner(req);
    const { ticketId, eventId } = await req.json();

    if (!ticketId || !eventId) {
      return fail(400, { code: "BAD_REQUEST", message: "ticketId and eventId are required" });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerProfileId: scanner.organizerProfileId },
      select: { id: true, startAt: true, endAt: true }
    });

    if (!event) {
      return fail(404, { code: "EVENT_NOT_FOUND", message: "Event not found or not managed by this organizer" });
    }
    
    // Check-in logic using raw query for performance on a potentially large table
    const updated = await prisma.$executeRaw`
      UPDATE "QRTicket"
      SET "checkedInAt" = NOW()
      WHERE id = ${ticketId}
        AND "checkedInAt" IS NULL
        AND "orderId" IN (
          SELECT id FROM "Order" WHERE "eventId" = ${eventId} AND status = 'PAID'
        )
    `;

    if (updated === 0) {
      // Could be already checked in, or invalid ticket, or wrong event.
      // We check which one to give a better error message.
      const ticket = await prisma.qRTicket.findUnique({
        where: { id: ticketId },
        include: { order: { select: { eventId: true, status: true } } },
      });

      if (!ticket || ticket.order.eventId !== eventId || ticket.order.status !== 'PAID') {
        return fail(404, { code: "TICKET_NOT_FOUND", message: "Ticket is not valid for this event" });
      }

      if (ticket.checkedInAt) {
        return fail(409, {
          code: "ALREADY_CHECKED_IN",
          message: "Ticket already checked in",
          details: { checkedInAt: ticket.checkedInAt.toISOString() },
        });
      }
      
      // Should be unreachable
      return fail(500, { code: "CHECK_IN_FAILED", message: "Check-in failed for an unknown reason" });
    }
    
    // Fetch the details to return a rich response
    const finalTicket = await prisma.qRTicket.findUnique({
      where: { id: ticketId },
      include: {
        order: { select: { buyerName: true, event: { select: { title: true } } } },
        orderItem: { include: { ticketType: { select: { name: true } } } },
      },
    });

    return ok({
      success: true,
      ticket: {
        ticketNumber: finalTicket!.ticketNumber,
        ticketTypeName: finalTicket!.orderItem.ticketType.name,
        buyerName: finalTicket!.order.buyerName,
        eventTitle: finalTicket!.order.event.title,
        checkedInAt: finalTicket!.checkedInAt!.toISOString(),
      },
    });

  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return fail(401, { code: "UNAUTHENTICATED", message: "Authentication required" });
      if (error.message === 'FORBIDDEN') return fail(403, { code: "FORBIDDEN", message: "Scanner role required" });
    }
    console.error("[POST /api/scanner/check-in]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "An unexpected error occurred" });
  }
}
