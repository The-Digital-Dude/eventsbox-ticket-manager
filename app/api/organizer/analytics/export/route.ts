import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail } from "@/src/lib/http/response";

function parseMonths(raw: string | null) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 12;
  if ([3, 6, 12, 24].includes(value)) return value;
  return 12;
}

function escapeCsv(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const months = parseMonths(req.nextUrl.searchParams.get("months"));

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Profile not found" });

    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - (months - 1));
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const events = await prisma.event.findMany({
      where: {
        organizerProfileId: profile.id,
        OR: [{ startAt: { gte: periodStart } }, { orders: { some: { paidAt: { gte: periodStart }, status: "PAID" } } }],
      },
      select: {
        title: true,
        status: true,
        startAt: true,
        ticketTypes: { select: { sold: true } },
        orders: {
          where: { status: "PAID" },
          select: {
            total: true,
            platformFee: true,
            tickets: { select: { checkedInAt: true } },
          },
        },
      },
      orderBy: { startAt: "desc" },
    });

    const headers = [
      "Event Title",
      "Status",
      "Start Date",
      "Tickets Sold",
      "Revenue (AUD)",
      "Platform Fee",
      "Check-in Rate",
    ];

    const rows = events.map((event) => {
      const ticketsSold = event.ticketTypes.reduce((sum, ticket) => sum + ticket.sold, 0);
      const revenue = event.orders.reduce((sum, order) => sum + Number(order.total), 0);
      const platformFee = event.orders.reduce((sum, order) => sum + Number(order.platformFee), 0);
      const allTickets = event.orders.flatMap((order) => order.tickets);
      const checkedIn = allTickets.filter((ticket) => Boolean(ticket.checkedInAt)).length;
      const checkinRate = allTickets.length > 0 ? `${Math.round((checkedIn / allTickets.length) * 100)}%` : "—";

      return [
        event.title,
        event.status,
        new Date(event.startAt).toISOString(),
        ticketsSold,
        revenue.toFixed(2),
        platformFee.toFixed(2),
        checkinRate,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsv(value)).join(","))
      .join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="analytics.csv"',
      },
    });
  } catch (error) {
    console.error("[api/organizer/analytics/export] export failed", error);
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
  }
}
