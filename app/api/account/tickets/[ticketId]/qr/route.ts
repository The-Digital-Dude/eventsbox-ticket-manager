import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { fail } from "@/src/lib/http/response";
import { generateQrPngBuffer } from "@/src/lib/qr";
import { accountTicketQrParamsSchema } from "@/src/lib/validators/account";

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
            attendeeUserId: true,
            status: true,
          },
        },
      },
    });

    if (!ticket || ticket.order.status !== "PAID") {
      return fail(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }

    if (ticket.order.attendeeUserId !== profile.id) {
      return fail(403, { code: "FORBIDDEN", message: "Ticket does not belong to your account" });
    }

    const png = await generateQrPngBuffer(ticket.id);

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-disposition": `inline; filename="ticket-${ticket.ticketNumber}.png"`,
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

    console.error("[app/api/account/tickets/[ticketId]/qr/route.ts][GET]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to generate ticket QR code" });
  }
}
