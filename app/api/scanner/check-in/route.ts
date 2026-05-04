import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { getScannerAccess, getScopedEvent, scannerAccessErrorResponse } from "@/src/lib/scanner-access";
import { writeAuditLog } from "@/src/lib/services/audit";

const checkinSchema = z.object({
  ticketId: z.string().min(1),
  eventId: z.string().min(1),
  deviceId: z.string().min(1),
  scannedAt: z.string().datetime(),
});

function serializeTicket(
  ticket: {
    id: string;
    ticketNumber: string;
    checkedInAt: Date | null;
    checkedInDevice: string | null;
    order: { buyerName: string | null };
    orderItem: { ticketType: { name: string } };
  },
) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketTypeName: ticket.orderItem.ticketType.name,
    attendeeName: ticket.order.buyerName,
    checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
    checkedInDevice: ticket.checkedInDevice,
  };
}

export async function POST(req: NextRequest) {
  try {
    const access = await getScannerAccess(req);
    const parsed = checkinSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid check-in payload",
        details: parsed.error.flatten(),
      });
    }

    const scopedEvent = await getScopedEvent(
      parsed.data.eventId,
      access.organizerProfileId,
    );
    if (!scopedEvent) {
      return fail(403, {
        code: "FORBIDDEN",
        message: "Event not found in your scanner scope",
      });
    }

    const ticket = await prisma.qRTicket.findFirst({
      where: {
        id: parsed.data.ticketId,
        order: {
          eventId: parsed.data.eventId,
          status: "PAID",
        },
      },
      select: {
        id: true,
        ticketNumber: true,
        isCheckedIn: true,
        checkedInAt: true,
        checkedInDevice: true,
        order: {
          select: {
            buyerName: true,
          },
        },
        orderItem: {
          select: {
            ticketType: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      await writeAuditLog({
        actorUserId: access.payload.sub,
        action: "SCANNER_INVALID_SCAN",
        entityType: "Event",
        entityId: parsed.data.eventId,
        metadata: {
          ticketId: parsed.data.ticketId,
          scannedAt: parsed.data.scannedAt,
          deviceId: parsed.data.deviceId,
        },
      });
      return ok({ outcome: "not_found" });
    }

    if (ticket.isCheckedIn || ticket.checkedInAt) {
      return ok({
        outcome: "already_checked_in",
        ticket: serializeTicket(ticket),
      });
    }

    const scannedAt = new Date(parsed.data.scannedAt);
    const updated = await prisma.qRTicket.updateMany({
      where: {
        id: parsed.data.ticketId,
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
        checkedInDevice: parsed.data.deviceId,
      },
    });

    if (updated.count === 0) {
      const latest = await prisma.qRTicket.findFirst({
        where: {
          id: parsed.data.ticketId,
          order: {
            eventId: parsed.data.eventId,
            status: "PAID",
          },
        },
        select: {
          id: true,
          ticketNumber: true,
          checkedInAt: true,
          checkedInDevice: true,
          order: {
            select: {
              buyerName: true,
            },
          },
          orderItem: {
            select: {
              ticketType: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!latest) {
        return ok({ outcome: "not_found" });
      }

      return ok({
        outcome: "already_checked_in",
        ticket: serializeTicket(latest),
      });
    }

    return ok({
      outcome: "ok",
      ticket: serializeTicket({
        ...ticket,
        checkedInAt: scannedAt,
        checkedInDevice: parsed.data.deviceId,
      }),
    });
  } catch (error) {
    const authResponse = scannerAccessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/scanner/check-in/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "An unexpected error occurred" });
  }
}
