import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

const PAGE_SIZE = 20;

function parsePage(raw: string | null) {
  const parsed = Number(raw ?? "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const { id } = await params;

    const page = parsePage(req.nextUrl.searchParams.get("page"));
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const event = await prisma.event.findFirst({
      where: { id, organizerProfileId: profile.id },
      select: { id: true },
    });
    if (!event) {
      return fail(404, { code: "NOT_FOUND", message: "Event not found" });
    }

    const where = {
      eventId: event.id,
      status: "PAID" as const,
      ...(q ? { buyerEmail: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          buyerName: true,
          buyerEmail: true,
          total: true,
          paidAt: true,
          items: {
            select: {
              quantity: true,
              ticketType: {
                select: { id: true, name: true },
              },
              tickets: {
                select: { id: true, checkedInAt: true },
              },
            },
          },
        },
        orderBy: { paidAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.order.count({ where }),
    ]);

    const attendees = orders.map((order) => {
      const tickets = order.items.map((item) => ({
        ticketTypeId: item.ticketType.id,
        ticketTypeName: item.ticketType.name,
        quantity: item.quantity,
      }));
      const totalTickets = order.items.reduce((sum, item) => sum + item.tickets.length, 0);
      const checkedInTickets = order.items.reduce(
        (sum, item) => sum + item.tickets.filter((ticket) => Boolean(ticket.checkedInAt)).length,
        0,
      );
      const checkinPercent = totalTickets > 0 ? Math.round((checkedInTickets / totalTickets) * 100) : 0;

      return {
        orderId: order.id,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        total: order.total,
        paidAt: order.paidAt,
        tickets,
        totalTickets,
        checkedInTickets,
        checkinPercent,
      };
    });

    return ok({
      attendees,
      total,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Organizer access required" });
    }

    console.error("[app/api/organizer/events/[id]/attendees/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load attendee roster" });
  }
}
