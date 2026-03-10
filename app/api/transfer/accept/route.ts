import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { fail, ok } from "@/src/lib/http/response";
import {
  sendTicketTransferAcceptedRecipientEmail,
  sendTicketTransferAcceptedSenderEmail,
} from "@/src/lib/services/notifications";

const acceptTransferSchema = z.object({
  token: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = acceptTransferSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid transfer token",
        details: parsed.error.flatten(),
      });
    }

    const transfer = await prisma.ticketTransfer.findUnique({
      where: { token: parsed.data.token },
      select: {
        id: true,
        fromEmail: true,
        toEmail: true,
        toName: true,
        status: true,
        expiresAt: true,
        qrTicket: {
          select: {
            id: true,
            ticketNumber: true,
            checkedInAt: true,
            order: {
              select: {
                id: true,
                status: true,
                event: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      return fail(404, { code: "NOT_FOUND", message: "Transfer not found" });
    }
    if (transfer.status !== "PENDING") {
      return fail(400, { code: "INVALID_TRANSFER", message: "This transfer is no longer valid" });
    }
    if (transfer.qrTicket.checkedInAt) {
      return fail(400, { code: "ALREADY_CHECKED_IN", message: "Checked-in tickets cannot be transferred" });
    }
    if (transfer.qrTicket.order.status !== "PAID") {
      return fail(400, { code: "INVALID_ORDER_STATUS", message: "Only paid tickets can be transferred" });
    }

    const now = new Date();
    if (transfer.expiresAt <= now) {
      await prisma.ticketTransfer.update({
        where: { id: transfer.id },
        data: { status: "EXPIRED" },
      });
      return fail(400, { code: "TRANSFER_EXPIRED", message: "This transfer link has expired" });
    }

    const recipientProfile = await prisma.attendeeProfile.findFirst({
      where: {
        user: {
          email: transfer.toEmail,
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: transfer.qrTicket.order.id },
        data: {
          buyerEmail: transfer.toEmail,
          buyerName: transfer.toName,
          attendeeUserId: recipientProfile?.id ?? null,
        },
      });

      await tx.ticketTransfer.update({
        where: { id: transfer.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: now,
        },
      });
    });

    const orderUrl = `${env.APP_URL}/orders/${transfer.qrTicket.order.id}`;
    void sendTicketTransferAcceptedRecipientEmail({
      to: transfer.toEmail,
      toName: transfer.toName,
      eventTitle: transfer.qrTicket.order.event.title,
      ticketNumber: transfer.qrTicket.ticketNumber,
      orderUrl,
    }).catch((error) => {
      console.error("[ticket-transfer][accepted-recipient-email]", error);
    });

    void sendTicketTransferAcceptedSenderEmail({
      to: transfer.fromEmail,
      recipientName: transfer.toName,
      recipientEmail: transfer.toEmail,
      eventTitle: transfer.qrTicket.order.event.title,
      ticketNumber: transfer.qrTicket.ticketNumber,
    }).catch((error) => {
      console.error("[ticket-transfer][accepted-sender-email]", error);
    });

    return ok({
      eventTitle: transfer.qrTicket.order.event.title,
      ticketNumber: transfer.qrTicket.ticketNumber,
    });
  } catch (error) {
    console.error("[app/api/transfer/accept/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to accept transfer" });
  }
}
