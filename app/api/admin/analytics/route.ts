import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { requireRole } from "@/src/lib/auth/guards";
import { authErrorResponse } from "@/src/lib/auth/error-response";
import { fail, ok } from "@/src/lib/http/response";

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

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

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      paidAgg,
      refundedAgg,
      ordersCount,
      refundsCount,
      paidOrders,
      paidItems,
      topAffiliateGroups,
      organizerCount,
      attendeeCount,
      reviewAgg,
    ] = await Promise.all([
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
              commissionPct: true,
              category: {
                select: {
                  name: true,
                },
              },
              organizerProfile: {
                select: {
                  id: true,
                  brandName: true,
                  companyName: true,
                  user: {
                    select: {
                      email: true,
                    },
                  },
                },
              },
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
      prisma.order.groupBy({
        by: ["affiliateLinkId"],
        where: { ...paidWhere, affiliateLinkId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.organizerProfile.count({
        where: {
          createdAt: { gte: monthStart },
        },
      }),
      prisma.attendeeProfile.count({
        where: {
          createdAt: { gte: monthStart },
        },
      }),
      prisma.eventReview.aggregate({
        where: { isVisible: true },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    const affiliateLinks = topAffiliateGroups.length > 0 
      ? await prisma.affiliateLink.findMany({
          where: { id: { in: topAffiliateGroups.map(g => g.affiliateLinkId as string) } },
          select: { id: true, code: true, label: true }
        })
      : [];

    const topAffiliates = topAffiliateGroups.map(g => {
      const link = affiliateLinks.find(l => l.id === g.affiliateLinkId);
      return {
        id: g.affiliateLinkId,
        code: link?.code || "Unknown",
        label: link?.label || "Unknown",
        ordersCount: g._count.id,
      };
    });

    const topEventsMap = new Map<string, { eventId: string; title: string; revenue: number; ticketsSold: number }>();
    const topOrganizersMap = new Map<string, { organizerId: string; brandName: string; revenue: number; events: Set<string> }>();
    const revenueByCategoryMap = new Map<string, { categoryName: string; revenue: number; orders: number }>();
    const revenueByDayMap = new Map<string, number>();
    let platformCommission = 0;

    for (const order of paidOrders) {
      const revenue = Number(order.total);
      const ticketsSold = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const organizerId = order.event.organizerProfile.id;
      const organizerName =
        order.event.organizerProfile.brandName ||
        order.event.organizerProfile.companyName ||
        order.event.organizerProfile.user.email;
      const categoryName = order.event.category?.name ?? "Uncategorized";

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

      const existingOrganizer = topOrganizersMap.get(organizerId);
      if (existingOrganizer) {
        existingOrganizer.revenue += revenue;
        existingOrganizer.events.add(order.eventId);
      } else {
        topOrganizersMap.set(organizerId, {
          organizerId,
          brandName: organizerName,
          revenue,
          events: new Set([order.eventId]),
        });
      }

      const existingCategory = revenueByCategoryMap.get(categoryName);
      if (existingCategory) {
        existingCategory.revenue += revenue;
        existingCategory.orders += 1;
      } else {
        revenueByCategoryMap.set(categoryName, {
          categoryName,
          revenue,
          orders: 1,
        });
      }

      if (order.paidAt) {
        const dateKey = order.paidAt.toISOString().slice(0, 10);
        revenueByDayMap.set(dateKey, (revenueByDayMap.get(dateKey) ?? 0) + revenue);
      }

      platformCommission += revenue * (Number(order.event.commissionPct) / 100);
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
      platformRevenue: grossRevenue,
      platformCommission: roundCurrency(platformCommission),
      revenueByCategory: Array.from(revenueByCategoryMap.values())
        .map((entry) => ({
          ...entry,
          revenue: roundCurrency(entry.revenue),
        }))
        .sort((left, right) => right.revenue - left.revenue),
      topOrganizers: Array.from(topOrganizersMap.values())
        .map((entry) => ({
          organizerId: entry.organizerId,
          brandName: entry.brandName,
          revenue: roundCurrency(entry.revenue),
          events: entry.events.size,
        }))
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 10),
      topEvents: Array.from(topEventsMap.values())
        .map((entry) => ({
          ...entry,
          revenue: roundCurrency(entry.revenue),
        }))
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 10),
      topAffiliates,
      revenueByDay: Array.from(revenueByDayMap.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, revenue]) => ({
          date,
          revenue: roundCurrency(revenue),
        })),
      newOrganizersThisMonth: organizerCount,
      newAttendeesThisMonth: attendeeCount,
      reviewStats: {
        totalReviews: reviewAgg._count.id ?? 0,
        averageRating: reviewAgg._count.id ? Number((reviewAgg._avg.rating ?? 0).toFixed(1)) : 0,
      },
    });
  } catch (error) {
    const authResponse = authErrorResponse(error, { forbiddenMessage: "Super admin access required" });
    if (authResponse) return authResponse;

    console.error("[app/api/admin/analytics/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load admin analytics" });
  }
}
