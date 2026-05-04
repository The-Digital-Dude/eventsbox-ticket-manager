import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { authErrorResponse } from "@/src/lib/auth/error-response";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { env } from "@/src/lib/env";
import { fail, ok } from "@/src/lib/http/response";
import { sendOrderConfirmationEmail } from "@/src/lib/services/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await requireAttendee(req);
    const { orderId } = await params;

    const profile = await prisma.attendeeProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        attendeeUserId: profile.id,
        status: OrderStatus.PAID,
      },
      include: {
        event: {
          select: {
            title: true,
            startAt: true,
            timezone: true,
            customConfirmationMessage: true,
            venue: { select: { name: true } },
          },
        },
        items: {
          include: {
            ticketType: { select: { name: true } },
            tickets: {
              orderBy: { createdAt: "asc" },
              select: { id: true, ticketNumber: true },
            },
          },
        },
      },
    });

    if (!order) {
      return fail(404, { code: "ORDER_NOT_FOUND", message: "Paid order not found" });
    }

    const result = await sendOrderConfirmationEmail({
      to: order.buyerEmail,
      buyerName: order.buyerName,
      orderId: order.id,
      eventTitle: order.event.title,
      startAt: order.event.startAt,
      timezone: order.event.timezone,
      venueName: order.event.venue?.name ?? null,
      tickets: order.items.flatMap((item) =>
        item.tickets.map((ticket) => ({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          ticketTypeName: item.ticketType.name,
        })),
      ),
      orderUrl: `${env.APP_URL}/account/orders`,
      customMessage: order.event.customConfirmationMessage,
    });

    if (!result.sent) {
      return fail(502, { code: "EMAIL_NOT_SENT", message: "Confirmation email could not be sent" });
    }

    return ok({ sent: true });
  } catch (error) {
    const authResponse = authErrorResponse(error, { forbiddenMessage: "Attendee account required" });
    if (authResponse) return authResponse;

    console.error("[app/api/account/orders/[orderId]/resend-confirmation/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to resend confirmation email" });
  }
}
