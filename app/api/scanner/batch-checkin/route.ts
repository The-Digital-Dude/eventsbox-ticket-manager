import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { rateLimitRedis } from "@/src/lib/http/rate-limit-redis";
import { writeAuditLog } from "@/src/lib/services/audit";
import { getScannerAccess, getScopedEvent, scannerAccessErrorResponse } from "@/src/lib/scanner-access";

const scanSchema = z.object({
  ticketId: z.string().min(1),
  scannedAt: z.string().datetime(),
  deviceId: z.string().min(1),
});

const batchSchema = z.object({
  eventId: z.string().min(1),
  scans: z.array(scanSchema).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const access = await getScannerAccess(req);
    const rateLimitKey = `scanner-batch-checkin:${access.payload.sub}`;
    const rateLimit = await rateLimitRedis(rateLimitKey, 10, 1_000);
    if (rateLimit.limited) {
      return fail(429, { code: "RATE_LIMITED", message: "Too many batch check-in requests" });
    }

    const parsed = batchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid batch check-in payload",
        details: parsed.error.flatten(),
      });
    }

    const scopedEvent = await getScopedEvent(parsed.data.eventId, access.organizerProfileId);
    if (!scopedEvent) {
      return fail(403, { code: "FORBIDDEN", message: "Event not found in your scanner scope" });
    }

    const uniqueTicketIds = [...new Set(parsed.data.scans.map((scan) => scan.ticketId))];
    const tickets = await prisma.qRTicket.findMany({
      where: {
        id: { in: uniqueTicketIds },
        order: {
          eventId: parsed.data.eventId,
          status: "PAID",
        },
      },
      select: {
        id: true,
        isCheckedIn: true,
        checkedInAt: true,
        checkedInDevice: true,
      },
    });

    const ticketMap = new Map(tickets.map((ticket) => [ticket.id, ticket]));
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

    const results: Array<{
      ticketId: string;
      outcome: "OK" | "DUPLICATE" | "NOT_FOUND" | "ERROR";
      checkedInAt?: string;
      firstScannedAt?: string | null;
      firstDeviceId?: string | null;
      firstDeviceName?: string | null;
    }> = [];

    for (const scan of parsed.data.scans) {
      try {
        const ticket = ticketMap.get(scan.ticketId);
        if (!ticket) {
          await writeAuditLog({
            actorUserId: access.payload.sub,
            action: "SCANNER_BATCH_INVALID_SCAN",
            entityType: "Event",
            entityId: parsed.data.eventId,
            metadata: {
              ticketId: scan.ticketId,
              scannedAt: scan.scannedAt,
              deviceId: scan.deviceId,
            },
          });
          results.push({ ticketId: scan.ticketId, outcome: "NOT_FOUND" });
          continue;
        }

        if (ticket.isCheckedIn || ticket.checkedInAt) {
          results.push({
            ticketId: scan.ticketId,
            outcome: "DUPLICATE",
            firstScannedAt: ticket.checkedInAt?.toISOString() ?? null,
            firstDeviceId: ticket.checkedInDevice ?? null,
            firstDeviceName: ticket.checkedInDevice ? deviceNameById.get(ticket.checkedInDevice) ?? null : null,
          });
          continue;
        }

        const scannedAt = new Date(scan.scannedAt);
        const updateResult = await prisma.qRTicket.updateMany({
          where: {
            id: scan.ticketId,
            isCheckedIn: false,
            checkedInAt: null,
            order: {
              eventId: parsed.data.eventId,
              status: "PAID",
            },
          },
          data: {
            isCheckedIn: true,
            checkedInAt: scannedAt,
            checkedInDevice: scan.deviceId,
          },
        });

        if (updateResult.count === 0) {
          const latest = await prisma.qRTicket.findFirst({
            where: {
              id: scan.ticketId,
              order: {
                eventId: parsed.data.eventId,
                status: "PAID",
              },
            },
            select: {
              checkedInAt: true,
              checkedInDevice: true,
            },
          });

          if (!latest) {
            results.push({ ticketId: scan.ticketId, outcome: "NOT_FOUND" });
            continue;
          }

          results.push({
            ticketId: scan.ticketId,
            outcome: "DUPLICATE",
            firstScannedAt: latest.checkedInAt?.toISOString() ?? null,
            firstDeviceId: latest.checkedInDevice ?? null,
            firstDeviceName: latest.checkedInDevice ? deviceNameById.get(latest.checkedInDevice) ?? null : null,
          });
          continue;
        }

        ticketMap.set(scan.ticketId, {
          ...ticket,
          isCheckedIn: true,
          checkedInAt: scannedAt,
          checkedInDevice: scan.deviceId,
        });

        await writeAuditLog({
          actorUserId: access.payload.sub,
          action: "SCANNER_BATCH_CHECKIN",
          entityType: "QRTicket",
          entityId: scan.ticketId,
          metadata: {
            eventId: parsed.data.eventId,
            scannedAt: scan.scannedAt,
            deviceId: scan.deviceId,
          },
        });

        results.push({
          ticketId: scan.ticketId,
          outcome: "OK",
          checkedInAt: scannedAt.toISOString(),
        });
      } catch (itemError) {
        console.error(
          "[app/api/scanner/batch-checkin/route.ts][POST][item]",
          scan.ticketId,
          itemError,
        );
        results.push({
          ticketId: scan.ticketId,
          outcome: "ERROR",
        });
      }
    }

    return ok({ results });
  } catch (error) {
    const authResponse = scannerAccessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/scanner/batch-checkin/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to process batch check-ins" });
  }
}
