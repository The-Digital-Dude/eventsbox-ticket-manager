import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { fail } from "@/src/lib/http/response";
import { TicketPdf } from "@/src/lib/pdf/ticket-pdf";
import { accountTicketQrParamsSchema } from "@/src/lib/validators/account";

export const runtime = "nodejs";

async function loadQrDataUrl(req: NextRequest, ticketId: string) {
  const qrUrl = new URL(`/api/account/tickets/${ticketId}/qr`, req.url);
  const res = await fetch(qrUrl, {
    headers: {
      cookie: req.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("QR_IMAGE_UNAVAILABLE");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const session = await requireAttendee(req);
    const parsedParams = accountTicketQrParamsSchema.safeParse(await params);

    if (!parsedParams.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid ticket id",
        details: parsedParams.error.flatten(),
      });
    }

    const profile = await prisma.attendeeProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" });
    }

    const ticket = await prisma.qRTicket.findUnique({
      where: { id: parsedParams.data.ticketId },
      select: {
        id: true,
        ticketNumber: true,
        seatLabel: true,
        order: {
          select: {
            attendeeUserId: true,
            status: true,
            event: {
              select: {
                title: true,
                startAt: true,
                timezone: true,
                venue: {
                  select: { name: true },
                },
              },
            },
          },
        },
        orderItem: {
          select: {
            ticketType: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!ticket || !ticket.order || ticket.order.status !== "PAID") {
      return fail(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }

    if (ticket.order.attendeeUserId !== profile.id) {
      return fail(403, { code: "FORBIDDEN", message: "Ticket does not belong to your account" });
    }

    const qrImageSrc = await loadQrDataUrl(req, ticket.id);
    const pdfDocument = createElement(TicketPdf, {
      ticket: {
        eventTitle: ticket.order.event.title,
        startAt: ticket.order.event.startAt,
        timezone: ticket.order.event.timezone,
        venueName: ticket.order.event.venue?.name ?? null,
        ticketTypeName: ticket.orderItem.ticketType.name,
        seatLabel: ticket.seatLabel,
        ticketNumber: ticket.ticketNumber,
        qrImageSrc,
      },
    }) as Parameters<typeof renderToBuffer>[0];
    const pdf = await renderToBuffer(pdfDocument);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="ticket-${ticket.ticketNumber}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Attendee account required" });
    }

    console.error("[app/api/account/tickets/[ticketId]/pdf/route.ts][GET]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to generate ticket PDF" });
  }
}
