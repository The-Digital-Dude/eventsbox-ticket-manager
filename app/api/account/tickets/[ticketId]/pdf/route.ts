import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { fail } from "@/src/lib/http/response";
import { generateQrDataUrl } from "@/src/lib/qr";
import { accountTicketQrParamsSchema } from "@/src/lib/validators/account";

function formatDateTime(value: Date): string {
  return value.toLocaleString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
        order: {
          select: {
            id: true,
            attendeeUserId: true,
            status: true,
            event: {
              select: {
                title: true,
                startAt: true,
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

    const { order } = ticket;
    const event = order.event;
    const venueName = event.venue?.name ?? null;
    const ticketTypeName = ticket.orderItem.ticketType.name;

    // Generate QR as base64 PNG data URL
    const qrDataUrl = await generateQrDataUrl(ticket.id);
    // Strip the data:image/png;base64, prefix to get raw base64
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const qrBuffer = Buffer.from(qrBase64, "base64");

    // Build PDF in memory
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: "A6", margin: 30 });

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 60; // margin * 2

      // Header
      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("EVENTSBOX", { align: "center" });

      doc.moveDown(0.3);
      doc
        .moveTo(30, doc.y)
        .lineTo(30 + pageWidth, doc.y)
        .strokeColor("#cccccc")
        .stroke();
      doc.moveDown(0.5);

      // Event title
      doc
        .fontSize(13)
        .font("Helvetica-Bold")
        .fillColor("#111111")
        .text(event.title, { align: "left" });

      // Date
      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#444444")
        .text(`Date: ${formatDateTime(event.startAt)}`);

      // Venue
      if (venueName) {
        doc.moveDown(0.2);
        doc.text(`Venue: ${venueName}`);
      }

      doc.moveDown(0.5);
      doc
        .moveTo(30, doc.y)
        .lineTo(30 + pageWidth, doc.y)
        .strokeColor("#cccccc")
        .stroke();
      doc.moveDown(0.5);

      // Ticket type
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#111111")
        .text(ticketTypeName);

      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#444444")
        .text(`Ticket #: ${ticket.ticketNumber}`);

      doc.moveDown(0.2);
      doc.text(`Order: ${order.id}`);

      doc.moveDown(0.8);

      // QR code image centered
      const qrSize = 150;
      const qrX = (doc.page.width - qrSize) / 2;
      doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize });

      doc.moveDown(0.5);
      const afterQr = doc.y + qrSize + 8;
      doc.y = afterQr;

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#666666")
        .text("Present this QR code at entry", { align: "center" });

      doc.end();
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
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
