import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { ok, fail } from "@/src/lib/http/response";
import { getScannerAccess, scannerAccessErrorResponse } from "@/src/lib/scanner-access";

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: NextRequest) {
  try {
    const access = await getScannerAccess(req);
    const from = parseDate(req.nextUrl.searchParams.get("from"));
    const to = parseDate(req.nextUrl.searchParams.get("to"));

    const events = await prisma.event.findMany({
      where: {
        organizerProfileId: access.organizerProfileId,
        ...(from || to
          ? {
              startAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        title: true,
        slug: true,
        startAt: true,
        endAt: true,
        venue: {
          select: {
            name: true,
          },
        },
        orders: {
          where: { status: "PAID" },
          select: {
            tickets: {
              select: {
                id: true,
                checkedInAt: true,
                isCheckedIn: true,
              },
            },
          },
        },
      },
    });

    return ok({
      events: events.map((event) => {
        const tickets = event.orders.flatMap((order) => order.tickets);
        const checkedInCount = tickets.filter((ticket) => ticket.isCheckedIn || Boolean(ticket.checkedInAt)).length;

        return {
          id: event.id,
          title: event.title,
          slug: event.slug,
          startAt: event.startAt,
          endAt: event.endAt,
          venueName: event.venue?.name ?? null,
          totalTickets: tickets.length,
          checkedInCount,
        };
      }),
    });
  } catch (error) {
    const authResponse = scannerAccessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/scanner/events/route.ts][GET]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load scanner events" });
  }
}
