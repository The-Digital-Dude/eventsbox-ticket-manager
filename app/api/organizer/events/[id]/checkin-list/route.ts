import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

const manualCheckInSchema = z.object({
  ticketId: z.string().min(1),
});

async function getOwnedEventId(eventId: string, organizerUserId: string) {
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: organizerUserId },
    select: { id: true },
  });
  if (!profile) {
    return null;
  }

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organizerProfileId: profile.id,
    },
    select: { id: true },
  });

  return event?.id ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const ownedEventId = await getOwnedEventId(id, auth.sub);
    if (!ownedEventId) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
    const checkedInParam = req.nextUrl.searchParams.get("checkedIn");
    const checkedInFilter =
      checkedInParam === "true" ? true : checkedInParam === "false" ? false : undefined;

    const ticketWhere = {
      order: {
        eventId: ownedEventId,
        status: "PAID" as const,
        ...(search
          ? {
              OR: [
                { buyerName: { contains: search, mode: "insensitive" as const } },
                { buyerEmail: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      ...(checkedInFilter === true
        ? { checkedInAt: { not: null as null } }
        : checkedInFilter === false
          ? { checkedInAt: null }
          : {}),
    };

    const [tickets, total, checkedIn] = await Promise.all([
      prisma.qRTicket.findMany({
        where: ticketWhere,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          ticketNumber: true,
          seatLabel: true,
          checkedInAt: true,
          isComplimentary: true,
          order: {
            select: {
              buyerName: true,
              buyerEmail: true,
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
            eventId: ownedEventId,
            status: "PAID",
          },
        },
      }),
      prisma.qRTicket.count({
        where: {
          order: {
            eventId: ownedEventId,
            status: "PAID",
          },
          checkedInAt: { not: null },
        },
      }),
    ]);

    return ok({
      tickets: tickets.map((ticket) => ({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketTypeName: ticket.orderItem.ticketType.name,
        buyerName: ticket.order.buyerName,
        buyerEmail: ticket.order.buyerEmail,
        seatLabel: ticket.seatLabel,
        checkedInAt: ticket.checkedInAt ? ticket.checkedInAt.toISOString() : null,
        isComplimentary: ticket.isComplimentary,
      })),
      summary: {
        total,
        checkedIn,
        remaining: Math.max(0, total - checkedIn),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
    }

    console.error("[app/api/organizer/events/[id]/checkin-list/route.ts][GET]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load attendee list" });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;
    const ownedEventId = await getOwnedEventId(id, auth.sub);
    if (!ownedEventId) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const parsed = manualCheckInSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "ticketId is required",
        details: parsed.error.flatten(),
      });
    }

    const ticket = await prisma.qRTicket.findFirst({
      where: {
        id: parsed.data.ticketId,
        order: {
          eventId: ownedEventId,
          status: "PAID",
        },
      },
      select: {
        id: true,
        checkedInAt: true,
      },
    });

    if (!ticket) {
      return fail(404, { code: "NOT_FOUND", message: "Ticket not found" });
    }

    if (ticket.checkedInAt) {
      return ok({
        alreadyCheckedIn: true,
        checkedInAt: ticket.checkedInAt.toISOString(),
      });
    }

    const updated = await prisma.qRTicket.update({
      where: { id: ticket.id },
      data: { checkedInAt: new Date() },
      select: { checkedInAt: true },
    });

    return ok({
      alreadyCheckedIn: false,
      checkedInAt: updated.checkedInAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
    }

    console.error("[app/api/organizer/events/[id]/checkin-list/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to check in attendee" });
  }
}
