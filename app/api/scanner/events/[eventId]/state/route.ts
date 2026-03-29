import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { getScannerAccess, getScopedEvent, scannerAccessErrorResponse } from "@/src/lib/scanner-access";

const querySchema = z.object({
  since: z.string().datetime(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const access = await getScannerAccess(req);
    const { eventId } = await params;
    const event = await getScopedEvent(eventId, access.organizerProfileId);
    if (!event) {
      return fail(403, { code: "FORBIDDEN", message: "Event not found in your scanner scope" });
    }

    const parsed = querySchema.safeParse({
      since: req.nextUrl.searchParams.get("since") ?? undefined,
    });
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "since must be a valid ISO datetime",
        details: parsed.error.flatten(),
      });
    }

    const since = new Date(parsed.data.since);
    const [tickets, totalCheckedIn] = await Promise.all([
      prisma.qRTicket.findMany({
        where: {
          order: {
            eventId,
            status: "PAID",
          },
          checkedInAt: {
            gt: since,
          },
        },
        orderBy: { checkedInAt: "asc" },
        select: {
          id: true,
          ticketNumber: true,
          isCheckedIn: true,
          checkedInAt: true,
          checkedInDevice: true,
        },
      }),
      prisma.qRTicket.count({
        where: {
          order: {
            eventId,
            status: "PAID",
          },
          OR: [
            { isCheckedIn: true },
            { checkedInAt: { not: null } },
          ],
        },
      }),
    ]);

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
          select: {
            deviceId: true,
            name: true,
          },
        })
      : [];
    const deviceNameById = new Map(devices.map((device) => [device.deviceId, device.name]));

    return ok({
      scans: tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        isCheckedIn: ticket.isCheckedIn || Boolean(ticket.checkedInAt),
        checkedInAt: ticket.checkedInAt,
        checkedInDevice: ticket.checkedInDevice,
        deviceName: ticket.checkedInDevice ? deviceNameById.get(ticket.checkedInDevice) ?? null : null,
      })),
      serverTime: new Date().toISOString(),
      totalCheckedIn,
    });
  } catch (error) {
    const authResponse = scannerAccessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/scanner/events/[eventId]/state/route.ts][GET]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load scanner state" });
  }
}
