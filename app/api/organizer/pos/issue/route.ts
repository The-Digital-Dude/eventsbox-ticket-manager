import { EventMode, Role, SeatInventoryStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/src/lib/auth/guards";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { fail, ok } from "@/src/lib/http/response";
import { generateQrDataUrl } from "@/src/lib/qr";
import { sendOrderConfirmationEmail } from "@/src/lib/services/notifications";

export const runtime = "nodejs";

const posIssueSchema = z.object({
  eventId: z.string().cuid(),
  ticketTypeId: z.string().cuid(),
  quantity: z.number().int().min(1).max(20).default(1),
  seatId: z.string().cuid().optional().nullable(),
  buyerName: z.string().trim().min(1).max(200),
  buyerEmail: z.string().trim().email(),
  paymentMethod: z.enum(["CASH", "CARD_EXTERNAL", "COMPLIMENTARY"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

function buildTicketNumber(orderId: string, ticketTypeName: string, index: number) {
  return `${orderId.slice(-6).toUpperCase()}-${ticketTypeName.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });

    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile not found" });
    }

    const parsed = posIssueSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid POS issue payload",
        details: parsed.error.flatten(),
      });
    }

    const input = parsed.data;
    const issued = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: {
          id: input.eventId,
          organizerProfileId: profile.id,
          status: "PUBLISHED",
        },
        select: {
          id: true,
          title: true,
          startAt: true,
          timezone: true,
          mode: true,
          commissionPct: true,
          gstPct: true,
          platformFeeFixed: true,
          customConfirmationMessage: true,
          venue: { select: { name: true } },
        },
      });

      if (!event) {
        throw new Error("EVENT_NOT_FOUND");
      }

      const ticketType = await tx.ticketType.findFirst({
        where: {
          id: input.ticketTypeId,
          eventId: event.id,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          quantity: true,
          sold: true,
          reservedQty: true,
          sectionId: true,
        },
      });

      if (!ticketType) {
        throw new Error("TICKET_TYPE_NOT_FOUND");
      }

      const isComplimentary = input.paymentMethod === "COMPLIMENTARY";
      const quantity = event.mode === EventMode.RESERVED_SEATING ? 1 : input.quantity;
      let selectedSeat: { id: string; seatLabel: string; sectionId: string } | null = null;

      if (event.mode === EventMode.RESERVED_SEATING) {
        if (!input.seatId) {
          throw new Error("SEAT_REQUIRED");
        }

        selectedSeat = await tx.seatInventory.findFirst({
          where: {
            id: input.seatId,
            eventId: event.id,
            status: SeatInventoryStatus.AVAILABLE,
          },
          select: {
            id: true,
            seatLabel: true,
            sectionId: true,
          },
        });

        if (!selectedSeat) {
          throw new Error("SEAT_UNAVAILABLE");
        }

        if (ticketType.sectionId !== selectedSeat.sectionId) {
          throw new Error("SEAT_TICKET_MISMATCH");
        }
      } else {
        const available = ticketType.quantity - ticketType.sold - ticketType.reservedQty;
        if (quantity > available) {
          throw new Error(`INSUFFICIENT_INVENTORY:${available}`);
        }
      }

      const unitPrice = isComplimentary ? 0 : Number(ticketType.price);
      const subtotal = unitPrice * quantity;
      const platformFee = isComplimentary
        ? 0
        : parseFloat(
            (subtotal * (Number(event.commissionPct) / 100) + Number(event.platformFeeFixed)).toFixed(2),
          );
      const gst = isComplimentary
        ? 0
        : parseFloat(((subtotal + platformFee) * (Number(event.gstPct) / 100)).toFixed(2));
      const total = parseFloat((subtotal + platformFee + gst).toFixed(2));

      const order = await tx.order.create({
        data: {
          eventId: event.id,
          buyerName: input.buyerName,
          buyerEmail: input.buyerEmail,
          subtotal,
          platformFee,
          gst,
          total,
          discountAmount: 0,
          status: "PAID",
          paidAt: new Date(),
          paymentMethod: input.paymentMethod,
          posNote: input.note ?? null,
        },
      });

      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          ticketTypeId: ticketType.id,
          quantity,
          unitPrice,
          subtotal,
        },
      });

      const tickets = [];
      for (let index = 0; index < quantity; index += 1) {
        const ticket = await tx.qRTicket.create({
          data: {
            orderId: order.id,
            orderItemId: orderItem.id,
            ticketNumber: buildTicketNumber(order.id, ticketType.name, index),
            seatId: selectedSeat?.id ?? null,
            seatLabel: selectedSeat?.seatLabel ?? null,
            isComplimentary,
          },
          select: {
            id: true,
            ticketNumber: true,
            seatLabel: true,
          },
        });
        tickets.push(ticket);
      }

      await tx.ticketType.update({
        where: { id: ticketType.id },
        data: { sold: { increment: quantity } },
      });

      if (selectedSeat) {
        await tx.seatInventory.update({
          where: { id: selectedSeat.id },
          data: {
            status: SeatInventoryStatus.SOLD,
            orderId: order.id,
            expiresAt: null,
          },
        });
      }

      return {
        orderId: order.id,
        event,
        ticketTypeName: ticketType.name,
        tickets,
      };
    });

    void sendOrderConfirmationEmail({
      to: input.buyerEmail,
      buyerName: input.buyerName,
      orderId: issued.orderId,
      eventTitle: issued.event.title,
      startAt: issued.event.startAt,
      timezone: issued.event.timezone,
      venueName: issued.event.venue?.name ?? null,
      tickets: issued.tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketTypeName: issued.ticketTypeName,
      })),
      orderUrl: `${env.APP_URL}/orders/${issued.orderId}`,
      customMessage: issued.event.customConfirmationMessage,
    }).catch((error) => {
      console.error("[app/api/organizer/pos/issue/route.ts][sendOrderConfirmationEmail]", error);
    });

    const ticketsWithQr = await Promise.all(
      issued.tickets.map(async (ticket) => ({
        ...ticket,
        ticketTypeName: issued.ticketTypeName,
        qrDataUrl: await generateQrDataUrl(ticket.id),
      })),
    );

    return ok({
      orderId: issued.orderId,
      tickets: ticketsWithQr,
    }, 201);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "EVENT_NOT_FOUND") {
        return fail(404, { code: "EVENT_NOT_FOUND", message: "Published event not found" });
      }
      if (error.message === "TICKET_TYPE_NOT_FOUND") {
        return fail(404, { code: "TICKET_TYPE_NOT_FOUND", message: "Ticket type not found" });
      }
      if (error.message === "SEAT_REQUIRED") {
        return fail(400, { code: "SEAT_REQUIRED", message: "Select an available seat first" });
      }
      if (error.message === "SEAT_UNAVAILABLE") {
        return fail(400, { code: "SEAT_UNAVAILABLE", message: "Selected seat is no longer available" });
      }
      if (error.message === "SEAT_TICKET_MISMATCH") {
        return fail(400, { code: "SEAT_TICKET_MISMATCH", message: "Selected seat does not match this ticket type" });
      }
      if (error.message.startsWith("INSUFFICIENT_INVENTORY:")) {
        const available = error.message.split(":")[1] ?? "0";
        return fail(400, { code: "INSUFFICIENT_INVENTORY", message: `Only ${available} tickets are available` });
      }
      if (error.message === "UNAUTHENTICATED") {
        return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
      }
      if (error.message === "FORBIDDEN") {
        return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
      }
    }

    console.error("[app/api/organizer/pos/issue/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to issue POS ticket" });
  }
}
