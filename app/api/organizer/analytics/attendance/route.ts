import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { authErrorResponse } from "@/src/lib/auth/error-response";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) {
      return fail(400, { code: "EVENT_ID_REQUIRED", message: "eventId is required" });
    }

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Profile not found" });

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerProfileId: profile.id },
      select: { id: true },
    });
    if (!event) return fail(404, { code: "NOT_FOUND", message: "Event not found" });

    const tickets = await prisma.qRTicket.findMany({
      where: {
        order: {
          eventId,
          status: "PAID",
        },
      },
      orderBy: [{ checkedInAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        ticketNumber: true,
        isCheckedIn: true,
        checkedInAt: true,
        checkedInDevice: true,
        order: {
          select: {
            buyerName: true,
            buyerEmail: true,
          },
        },
      },
    });

    const deviceIds = [
      ...new Set(
        tickets
          .map((ticket) => ticket.checkedInDevice)
          .filter((deviceId): deviceId is string => Boolean(deviceId)),
      ),
    ];
    const devices = deviceIds.length
      ? await prisma.scannerDevice.findMany({
          where: { deviceId: { in: deviceIds } },
          select: { deviceId: true, name: true },
        })
      : [];
    const deviceNameById = new Map(devices.map((device) => [device.deviceId, device.name]));

    const checkedInTickets = tickets.filter((ticket) => ticket.isCheckedIn || Boolean(ticket.checkedInAt));
    const totalIssued = tickets.length;
    const checkedIn = checkedInTickets.length;

    return ok({
      totalIssued,
      checkedIn,
      noShows: Math.max(totalIssued - checkedIn, 0),
      checkInRate: totalIssued > 0 ? Math.round((checkedIn / totalIssued) * 100) : 0,
      scanHistory: checkedInTickets.map((ticket) => ({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        attendeeName: ticket.order.buyerName,
        attendeeEmail: ticket.order.buyerEmail,
        checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
        device: ticket.checkedInDevice ? deviceNameById.get(ticket.checkedInDevice) ?? ticket.checkedInDevice : null,
      })),
    });
  } catch (error) {
    const authResponse = authErrorResponse(error, { forbiddenMessage: "Organizer only" });
    if (authResponse) return authResponse;
    console.error("[api/organizer/analytics/attendance] failed", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load attendance analytics" });
  }
}
