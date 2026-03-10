import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { fail, ok } from "@/src/lib/http/response";

function parseRange(req: NextRequest) {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  defaultFrom.setHours(0, 0, 0, 0);

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  const parsedFrom = fromParam ? new Date(fromParam) : defaultFrom;
  const parsedTo = toParam ? new Date(toParam) : now;

  const from = Number.isNaN(parsedFrom.getTime()) ? defaultFrom : parsedFrom;
  const to = Number.isNaN(parsedTo.getTime()) ? now : parsedTo;

  return {
    from,
    to,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, Role.SUPER_ADMIN);
    const { from, to } = parseRange(req);

    const paidWhere = {
      status: "PAID" as const,
      paidAt: {
        gte: from,
        lte: to,
      },
    };
    const refundedWhere = {
      status: "REFUNDED" as const,
      updatedAt: {
        gte: from,
        lte: to,
      },
    };

    const [paidAgg, refundedAgg, ordersCount, refundsCount, paidOrders, paidItems] = await Promise.all([
      prisma.order.aggregate({
        where: paidWhere,
        _sum: {
          total: true,
          platformFee: true,
        },
      }),
      prisma.order.aggregate({
        where: refundedWhere,
        _sum: {
          total: true,
        },
      }),
      prisma.order.count({ where: paidWhere }),
      prisma.order.count({ where: refundedWhere }),
      prisma.order.findMany({
        where: paidWhere,
        select: {
          eventId: true,
          total: true,
          paidAt: true,
          event: {
            select: {
              title: true,
            },
          },
          items: {
            select: {
              quantity: true,
            },
          },
        },
      }),
      prisma.orderItem.findMany({
        where: {
          order: paidWhere,
        },
        select: {
          quantity: true,
        },
      }),
    ]);

    const topEventsMap = new Map<string, { eventId: string; title: string; revenue: number; ticketsSold: number }>();
    const revenueByDayMap = new Map<string, number>();

    for (const order of paidOrders) {
      const revenue = Number(order.total);
      const ticketsSold = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const existingEvent = topEventsMap.get(order.eventId);
      if (existingEvent) {
        existingEvent.revenue += revenue;
        existingEvent.ticketsSold += ticketsSold;
      } else {
        topEventsMap.set(order.eventId, {
          eventId: order.eventId,
          title: order.event.title,
          revenue,
          ticketsSold,
        });
      }

      if (order.paidAt) {
        const dateKey = order.paidAt.toISOString().slice(0, 10);
        revenueByDayMap.set(dateKey, (revenueByDayMap.get(dateKey) ?? 0) + revenue);
      }
    }

    const grossRevenue = Number(paidAgg._sum.total ?? 0);
    const platformFees = Number(paidAgg._sum.platformFee ?? 0);
    const refunded = Number(refundedAgg._sum.total ?? 0);
    const ticketsSold = paidItems.reduce((sum, item) => sum + item.quantity, 0);

    return ok({
      summary: {
        grossRevenue,
        platformFees,
        refunded,
        netRevenue: grossRevenue - refunded,
        ticketsSold,
        ordersCount,
        refundsCount,
      },
      topEvents: Array.from(topEventsMap.values())
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 5),
      revenueByDay: Array.from(revenueByDayMap.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, revenue]) => ({
          date,
          revenue,
        })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return fail(401, { code: "UNAUTHENTICATED", message: "Login required" });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return fail(403, { code: "FORBIDDEN", message: "Super admin access required" });
    }

    console.error("[app/api/admin/analytics/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load admin analytics" });
  }
}
