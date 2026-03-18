import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { getScannerAccess, getScopedEvent, scannerAccessErrorResponse } from "@/src/lib/scanner-access";

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(500),
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
      cursor: req.nextUrl.searchParams.get("cursor") ?? undefined,
      limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid pagination parameters",
        details: parsed.error.flatten(),
      });
    }

    const [tickets, total] = await Promise.all([
      prisma.qRTicket.findMany({
        where: {
          order: {
            eventId,
            status: "PAID",
          },
          ...(parsed.data.cursor ? { id: { gt: parsed.data.cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take: parsed.data.limit,
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
      }),
      prisma.qRTicket.count({
        where: {
          order: {
            eventId,
            status: "PAID",
          },
        },
      }),
    ]);

    return ok({
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketTypeName: ticket.orderItem.ticketType.name,
        holderName: ticket.order.buyerName,
        isCheckedIn: ticket.isCheckedIn || Boolean(ticket.checkedInAt),
        checkedInAt: ticket.checkedInAt,
        checkedInDevice: ticket.checkedInDevice,
      })),
      nextCursor: tickets.length === parsed.data.limit ? tickets.at(-1)?.id ?? null : null,
      total,
    });
  } catch (error) {
    const authResponse = scannerAccessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/scanner/events/[eventId]/tickets/route.ts][GET]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load event tickets" });
  }
}
