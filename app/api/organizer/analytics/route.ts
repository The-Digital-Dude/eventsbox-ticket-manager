import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

function parseMonths(raw: string | null) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 12;
  if ([3, 6, 12, 24].includes(value)) return value;
  return 12;
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

    // Per-event stats
    const events = await prisma.event.findMany({
      where: { organizerProfileId: profile.id },
      select: {
        id: true,
        title: true,
        status: true,
        startAt: true,
        ticketTypes: { select: { quantity: true, sold: true } },
        orders: {
          where: { status: "PAID" },
          select: {
            total: true,
            platformFee: true,
            paidAt: true,
            tickets: { select: { checkedInAt: true } },
          },
        },
      },
      orderBy: { startAt: "desc" },
    });

    // Compute per-event row
    const eventRows = events.map((e) => {
      const totalQty = e.ticketTypes.reduce((s, t) => s + t.quantity, 0);
      const totalSold = e.ticketTypes.reduce((s, t) => s + t.sold, 0);
      const grossRevenue = e.orders.reduce((s, o) => s + Number(o.total), 0);
      const netRevenue = e.orders.reduce(
        (s, o) => s + Number(o.total) - Number(o.platformFee),
        0,
      );
      const allTickets = e.orders.flatMap((o) => o.tickets);
      const checkedIn = allTickets.filter((t) => t.checkedInAt).length;
      const checkinRate = allTickets.length > 0 ? Math.round((checkedIn / allTickets.length) * 100) : null;
      return {
        id: e.id,
        title: e.title,
        status: e.status,
        startAt: e.startAt,
        totalQty,
        totalSold,
        sellThrough: totalQty > 0 ? Math.round((totalSold / totalQty) * 100) : 0,
        grossRevenue: parseFloat(grossRevenue.toFixed(2)),
        netRevenue: parseFloat(netRevenue.toFixed(2)),
        checkinRate,
        paidOrders: e.orders.length,
      };
    });

    // Monthly revenue/ticket sales in selected period
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - (months - 1));
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const recentOrders = await prisma.order.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: periodStart },
        event: { organizerProfileId: profile.id },
      },
      select: { total: true, paidAt: true, items: { select: { quantity: true } } },
    });

    // Group by YYYY-MM
    const monthMap: Record<string, { revenue: number; count: number; tickets: number }> = {};
    for (const order of recentOrders) {
      if (!order.paidAt) continue;
      const key = `${order.paidAt.getFullYear()}-${String(order.paidAt.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { revenue: 0, count: 0, tickets: 0 };
      monthMap[key].revenue += Number(order.total);
      monthMap[key].count += 1;
      monthMap[key].tickets += order.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    // Fill selected period (even empty months)
    const monthly: Array<{ month: string; label: string; revenue: number; count: number; tickets: number }> = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      monthly.push({
        month: key,
        label,
        revenue: parseFloat((monthMap[key]?.revenue ?? 0).toFixed(2)),
        count: monthMap[key]?.count ?? 0,
        tickets: monthMap[key]?.tickets ?? 0,
      });
    }

    const totalGross = eventRows.reduce((sum, event) => sum + event.grossRevenue, 0);
    const totalNet = eventRows.reduce((sum, event) => sum + event.netRevenue, 0);
    const totalTicketsSold = eventRows.reduce((sum, event) => sum + event.totalSold, 0);
    const totalPaidOrders = eventRows.reduce((sum, event) => sum + event.paidOrders, 0);
    const topEvents = [...eventRows]
      .sort((a, b) => b.grossRevenue - a.grossRevenue)
      .slice(0, 5);

    return ok({
      period: { months },
      summary: {
        totalGross: parseFloat(totalGross.toFixed(2)),
        totalNet: parseFloat(totalNet.toFixed(2)),
        totalTicketsSold,
        totalPaidOrders,
      },
      monthly,
      topEvents,
      events: eventRows.slice(0, 20),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHENTICATED") return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    if (msg === "FORBIDDEN") return fail(403, { code: "FORBIDDEN", message: "Access denied" });
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to fetch analytics" });
  }
}
