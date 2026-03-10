import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { fail, ok } from "@/src/lib/http/response";
import {
  sendTicketTransferInviteEmail,
  sendTicketTransferSenderEmail,
} from "@/src/lib/services/notifications";

const transferSchema = z.object({
  toEmail: z.string().trim().email(),
  toName: z.string().trim().min(1).max(200),
});

const TRANSFER_EXPIRY_MS = 48 * 60 * 60 * 1000;

async function getOwnedTicket(orderId: string, ticketId: string, userId: string) {
  const attendeeProfile = await prisma.attendeeProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!attendeeProfile) {
    return { attendeeProfileId: null, ticket: null };
  }

  const ticket = await prisma.qRTicket.findFirst({
    where: {
      id: ticketId,
      orderId,
      order: {
        attendeeUserId: attendeeProfile.id,
      },
    },
    select: {
      id: true,
      ticketNumber: true,
      checkedInAt: true,
      order: {
        select: {
          id: true,
          buyerEmail: true,
          status: true,
          event: {
            select: {
              title: true,
              startAt: true,
            },
          },
          tickets: {
            select: {
              id: true,
            },
          },
        },
      },
      transfers: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          toEmail: true,
          toName: true,
          expiresAt: true,
        },
      },
    },
  });

  return { attendeeProfileId: attendeeProfile.id, ticket };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string; ticketId: string }> },
) {
  try {
    const session = await requireAttendee(req);
    const { orderId, ticketId } = await params;
    const parsed = transferSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid transfer payload",
        details: parsed.error.flatten(),
      });
    }

    const { ticket } = await getOwnedTicket(orderId, ticketId, session.user.id);
    if (!ticket || ticket.order.status !== "PAID") {
      return fail(404, { code: "NOT_FOUND", message: "Paid ticket not found for attendee" });
    }
    if (ticket.order.tickets.length !== 1) {
      return fail(400, {
        code: "PARTIAL_TRANSFER_UNSUPPORTED",
        message: "Ticket transfer is only available for single-ticket orders right now",
      });
    }
    if (ticket.checkedInAt) {
      return fail(400, { code: "ALREADY_CHECKED_IN", message: "Checked-in tickets cannot be transferred" });
    }
    if (new Date(ticket.order.event.startAt).getTime() <= Date.now()) {
      return fail(400, { code: "EVENT_STARTED", message: "Tickets cannot be transferred after the event starts" });
    }
    if (ticket.order.buyerEmail.toLowerCase() === parsed.data.toEmail.toLowerCase()) {
      return fail(400, { code: "SAME_RECIPIENT", message: "Recipient email must be different from the current buyer" });
    }
    if (ticket.transfers[0]?.status === "PENDING") {
      return fail(409, { code: "TRANSFER_PENDING", message: "A transfer is already pending for this ticket" });
    }

    const expiresAt = new Date(Date.now() + TRANSFER_EXPIRY_MS);
    const transfer = await prisma.ticketTransfer.create({
      data: {
        qrTicketId: ticket.id,
        fromEmail: ticket.order.buyerEmail,
        toEmail: parsed.data.toEmail,
        toName: parsed.data.toName,
        expiresAt,
      },
      select: {
        id: true,
        token: true,
        expiresAt: true,
      },
    });

    const acceptUrl = `${env.APP_URL}/transfer/accept?token=${transfer.token}`;
    void sendTicketTransferInviteEmail({
      to: parsed.data.toEmail,
      toName: parsed.data.toName,
      fromEmail: ticket.order.buyerEmail,
      eventTitle: ticket.order.event.title,
      ticketNumber: ticket.ticketNumber,
      acceptUrl,
      expiresAt,
    }).catch((error) => {
      console.error("[ticket-transfer][invite-email]", error);
    });

    void sendTicketTransferSenderEmail({
      to: ticket.order.buyerEmail,
      recipientName: parsed.data.toName,
      recipientEmail: parsed.data.toEmail,
      eventTitle: ticket.order.event.title,
      ticketNumber: ticket.ticketNumber,
      expiresAt,
    }).catch((error) => {
      console.error("[ticket-transfer][sender-email]", error);
    });

    return ok({
      transferId: transfer.id,
      expiresAt: transfer.expiresAt.toISOString(),
      toEmail: parsed.data.toEmail,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Attendee access required" });
    }

    console.error("[app/api/account/orders/[orderId]/tickets/[ticketId]/transfer/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to create ticket transfer" });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string; ticketId: string }> },
) {
  try {
    const session = await requireAttendee(req);
    const { orderId, ticketId } = await params;
    const { ticket } = await getOwnedTicket(orderId, ticketId, session.user.id);
    if (!ticket) {
      return fail(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }

    const pendingTransfer = ticket.transfers[0];
    if (!pendingTransfer || pendingTransfer.status !== "PENDING") {
      return fail(404, { code: "NOT_FOUND", message: "Pending transfer not found" });
    }

    await prisma.ticketTransfer.update({
      where: { id: pendingTransfer.id },
      data: { status: "CANCELLED" },
    });

    return ok({ cancelled: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Attendee access required" });
    }

    console.error("[app/api/account/orders/[orderId]/tickets/[ticketId]/transfer/route.ts][DELETE]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to cancel ticket transfer" });
  }
}
