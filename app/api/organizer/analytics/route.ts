import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);

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
      take: 20,
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

    // Monthly revenue (last 12 months) — compute from orders
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const recentOrders = await prisma.order.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: twelveMonthsAgo },
        event: { organizerProfileId: profile.id },
      },
      select: { total: true, paidAt: true },
    });

    // Group by YYYY-MM
    const monthMap: Record<string, { revenue: number; count: number }> = {};
    for (const order of recentOrders) {
      if (!order.paidAt) continue;
      const key = `${order.paidAt.getFullYear()}-${String(order.paidAt.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { revenue: 0, count: 0 };
      monthMap[key].revenue += Number(order.total);
      monthMap[key].count += 1;
    }

    // Fill all 12 months (even empty ones)
    const monthly: Array<{ month: string; label: string; revenue: number; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      monthly.push({
        month: key,
        label,
        revenue: parseFloat((monthMap[key]?.revenue ?? 0).toFixed(2)),
        count: monthMap[key]?.count ?? 0,
      });
    }

    return ok({ events: eventRows, monthly });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHENTICATED") return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    if (msg === "FORBIDDEN") return fail(403, { code: "FORBIDDEN", message: "Access denied" });
    return fail(500, { code: "INTERNAL_ERROR", message: "Failed to fetch analytics" });
  }
}
