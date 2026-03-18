import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail } from "@/src/lib/http/response";
import { getOrganizerAnalyticsData } from "@/src/lib/analytics/organizer";

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
    const type = req.nextUrl.searchParams.get("type") ?? "orders";
    const eventId = req.nextUrl.searchParams.get("eventId");

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: auth.sub },
      select: { id: true },
    });
    if (!profile) return fail(404, { code: "NOT_FOUND", message: "Profile not found" });

    const analytics = await getOrganizerAnalyticsData({
      organizerProfileId: profile.id,
      months,
      eventId,
    });

    let headers: string[] = [];
    let rows: Array<Array<string | number>> = [];

    if (type === "ticket-types") {
      headers = ["Ticket Type", "Units Sold", "Revenue"];
      rows = analytics.revenueByTicketType.map((row) => [
        row.ticketTypeName,
        row.sold,
        row.revenue.toFixed(2),
      ]);
    } else if (type === "addons") {
      headers = ["Add-on Name", "Qty Sold", "Revenue"];
      rows = analytics.revenueByAddOn.map((row) => [
        row.addOnName,
        row.quantity,
        row.revenue.toFixed(2),
      ]);
    } else if (type === "promo-codes") {
      headers = ["Code", "Orders", "Discount Total"];
      rows = analytics.revenueByPromoCode.map((row) => [
        row.code,
        row.orders,
        row.discount.toFixed(2),
      ]);
    } else {
      headers = [
        "Event Title",
        "Status",
        "Start Date",
        "Tickets Sold",
        "Revenue (AUD)",
        "Net Revenue",
        "Check-in Rate",
      ];
      rows = analytics.events.map((event) => [
        event.title,
        event.status,
        new Date(event.startAt).toISOString(),
        event.totalSold,
        event.grossRevenue.toFixed(2),
        event.netRevenue.toFixed(2),
        event.checkinRate === null ? "—" : `${event.checkinRate}%`,
      ]);
    }

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsv(value)).join(","))
      .join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-${type}.csv"`,
      },
    });
  } catch (error) {
    console.error("[api/organizer/analytics/export] export failed", error);
    return fail(403, { code: "FORBIDDEN", message: "Organizer only" });
  }
}
