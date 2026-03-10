import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/guards";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { fail, ok } from "@/src/lib/http/response";
import { sendComplimentaryTicketEmail } from "@/src/lib/services/notifications";

const createCompTicketSchema = z.object({
  ticketTypeId: z.string().cuid(),
  recipientName: z.string().trim().min(1).max(200),
  recipientEmail: z.string().trim().email(),
  note: z.string().trim().max(1000).optional().nullable(),
});

async function getOwnedEvent(eventId: string, userId: string) {
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    return { profileId: null, event: null };
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerProfileId: profile.id },
    include: {
      venue: {
        select: {
          name: true,
        },
      },
      ticketTypes: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          quantity: true,
          sold: true,
          reservedQty: true,
          compIssued: true,
          price: true,
          isActive: true,
        },
      },
    },
  });

  return { profileId: profile.id, event };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const { event } = await getOwnedEvent(id, auth.sub);
    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const issuances = await prisma.compTicketIssuance.findMany({
      where: {
        ticketType: {
          eventId: id,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        recipientName: true,
        recipientEmail: true,
        note: true,
        createdAt: true,
        ticketType: {
          select: {
            id: true,
            name: true,
          },
        },
        qrTicket: {
          select: {
            id: true,
            ticketNumber: true,
          },
        },
      },
    });

    return ok({
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        ticketTypes: event.ticketTypes,
      },
      issuances,
    });
  } catch (error) {
    console.error("[app/api/organizer/events/[id]/comp-tickets/route.ts][GET]", error);
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const { event } = await getOwnedEvent(id, auth.sub);
    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const parsed = createCompTicketSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid complimentary ticket payload",
        details: parsed.error.flatten(),
      });
    }

    const ticketType = event.ticketTypes.find((ticket) => ticket.id === parsed.data.ticketTypeId);
    if (!ticketType) {
      return fail(404, { code: "TICKET_TYPE_NOT_FOUND", message: "Ticket type not found" });
    }
    if (ticketType.compIssued >= ticketType.reservedQty) {
      return fail(400, { code: "NO_COMP_SLOTS", message: "No complimentary ticket slots remaining" });
    }

    const issuance = await prisma.$transaction(async (tx) => {
      const freshTicketType = await tx.ticketType.findFirst({
        where: {
          id: parsed.data.ticketTypeId,
          eventId: id,
        },
        select: {
          id: true,
          name: true,
          price: true,
          reservedQty: true,
          compIssued: true,
        },
      });

      if (!freshTicketType) {
        throw new Error("TICKET_TYPE_NOT_FOUND");
      }
      if (freshTicketType.compIssued >= freshTicketType.reservedQty) {
        throw new Error("NO_COMP_SLOTS");
      }

      const createdOrder = await tx.order.create({
        data: {
          eventId: id,
          buyerName: parsed.data.recipientName,
          buyerEmail: parsed.data.recipientEmail,
          subtotal: 0,
          discountAmount: 0,
          platformFee: 0,
          gst: 0,
          total: 0,
          status: "PAID",
          paidAt: new Date(),
        },
      });

      const createdOrderItem = await tx.orderItem.create({
        data: {
          orderId: createdOrder.id,
          ticketTypeId: freshTicketType.id,
          quantity: 1,
          unitPrice: freshTicketType.price,
          subtotal: 0,
        },
      });

      const createdTicket = await tx.qRTicket.create({
        data: {
          orderId: createdOrder.id,
          orderItemId: createdOrderItem.id,
          ticketNumber: `${createdOrder.id.slice(-6).toUpperCase()}-${freshTicketType.name.slice(0, 3).toUpperCase()}-001`,
          isComplimentary: true,
        },
      });

      const createdIssuance = await tx.compTicketIssuance.create({
        data: {
          ticketTypeId: freshTicketType.id,
          issuedByUserId: auth.sub,
          recipientName: parsed.data.recipientName,
          recipientEmail: parsed.data.recipientEmail,
          note: parsed.data.note || null,
          qrTicketId: createdTicket.id,
        },
        select: {
          id: true,
          recipientName: true,
          recipientEmail: true,
          note: true,
          createdAt: true,
          ticketType: {
            select: {
              id: true,
              name: true,
            },
          },
          qrTicket: {
            select: {
              id: true,
              ticketNumber: true,
            },
          },
        },
      });

      await tx.ticketType.update({
        where: { id: freshTicketType.id },
        data: {
          compIssued: { increment: 1 },
          sold: { increment: 1 },
        },
      });

      return {
        issuance: createdIssuance,
        orderId: createdOrder.id,
        ticketTypeName: freshTicketType.name,
        ticketNumber: createdTicket.ticketNumber,
      };
    });

    void sendComplimentaryTicketEmail({
      to: parsed.data.recipientEmail,
      recipientName: parsed.data.recipientName,
      eventTitle: event.title,
      ticketTypeName: issuance.ticketTypeName,
      ticketNumber: issuance.ticketNumber,
      startAt: event.startAt,
      timezone: event.timezone,
      venueName: event.venue?.name ?? null,
      orderUrl: `${env.APP_URL}/orders/${issuance.orderId}`,
    }).catch((error) => {
      console.error("[app/api/organizer/events/[id]/comp-tickets/route.ts][sendComplimentaryTicketEmail]", error);
    });

    return ok({ issuance: issuance.issuance });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_COMP_SLOTS") {
      return fail(400, { code: "NO_COMP_SLOTS", message: "No complimentary ticket slots remaining" });
    }
    if (error instanceof Error && error.message === "TICKET_TYPE_NOT_FOUND") {
      return fail(404, { code: "TICKET_TYPE_NOT_FOUND", message: "Ticket type not found" });
    }

    console.error("[app/api/organizer/events/[id]/comp-tickets/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to issue complimentary ticket" });
  }
}
