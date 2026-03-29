import { prisma } from "@/src/lib/db";

export type OrganizerAnalyticsData = {
  period: {
    months: number;
    eventId: string | null;
  };
  summary: {
    totalGross: number;
    totalNet: number;
    totalTicketsSold: number;
    totalPaidOrders: number;
  };
  monthly: Array<{
    month: string;
    label: string;
    revenue: number;
    count: number;
    tickets: number;
  }>;
  topEvents: Array<{
    id: string;
    title: string;
    status: string;
    startAt: Date;
    totalQty: number;
    totalSold: number;
    sellThrough: number;
    grossRevenue: number;
    netRevenue: number;
    checkinRate: number | null;
    paidOrders: number;
  }>;
  events: Array<{
    id: string;
    title: string;
    status: string;
    startAt: Date;
    totalQty: number;
    totalSold: number;
    sellThrough: number;
    grossRevenue: number;
    netRevenue: number;
    checkinRate: number | null;
    paidOrders: number;
  }>;
  revenueByTicketType: Array<{
    ticketTypeName: string;
    revenue: number;
    sold: number;
  }>;
  revenueByPromoCode: Array<{
    code: string;
    discount: number;
    orders: number;
  }>;
  revenueByAddOn: Array<{
    addOnName: string;
    revenue: number;
    quantity: number;
  }>;
  revenueByDay: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  affiliateStats: Array<{
    code: string;
    label: string;
    orders: number;
    revenue: number;
  }>;
  reviewSummary: {
    averageRating: number;
    totalReviews: number;
  };
};

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export async function getOrganizerAnalyticsData(input: {
  organizerProfileId: string;
  months: number;
  eventId?: string | null;
}): Promise<OrganizerAnalyticsData> {
  const eventFilter = input.eventId ?? null;

  const eventWhere = {
    organizerProfileId: input.organizerProfileId,
    ...(eventFilter ? { id: eventFilter } : {}),
  };

  const paidOrderWhere = {
    status: "PAID" as const,
    event: eventWhere,
  };

  const periodStart = new Date();
  periodStart.setMonth(periodStart.getMonth() - (input.months - 1));
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  ninetyDaysAgo.setHours(0, 0, 0, 0);

  const [events, recentOrders, ticketTypeRows, promoOrders, addOnRows, affiliateOrders, reviewAgg, recentDailyOrders] =
    await Promise.all([
      prisma.event.findMany({
        where: eventWhere,
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
              tickets: { select: { checkedInAt: true, isCheckedIn: true } },
            },
          },
        },
        orderBy: { startAt: "desc" },
      }),
      prisma.order.findMany({
        where: {
          ...paidOrderWhere,
          paidAt: { gte: periodStart },
        },
        select: {
          total: true,
          paidAt: true,
          items: { select: { quantity: true } },
        },
      }),
      prisma.orderItem.findMany({
        where: {
          order: paidOrderWhere,
        },
        select: {
          quantity: true,
          subtotal: true,
          ticketType: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.order.findMany({
        where: {
          ...paidOrderWhere,
          promoCodeId: { not: null },
        },
        select: {
          discountAmount: true,
          promoCode: {
            select: {
              code: true,
            },
          },
        },
      }),
      prisma.orderAddOn.findMany({
        where: {
          order: paidOrderWhere,
        },
        select: {
          name: true,
          quantity: true,
          subtotal: true,
        },
      }),
      prisma.order.findMany({
        where: {
          ...paidOrderWhere,
          affiliateLinkId: { not: null },
        },
        select: {
          total: true,
          affiliateLink: {
            select: {
              code: true,
              label: true,
            },
          },
        },
      }),
      prisma.eventReview.aggregate({
        where: {
          isVisible: true,
          event: eventWhere,
        },
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.order.findMany({
        where: {
          ...paidOrderWhere,
          paidAt: { gte: ninetyDaysAgo },
        },
        select: {
          total: true,
          paidAt: true,
        },
        orderBy: { paidAt: "asc" },
      }),
    ]);

  const eventRows = events.map((event) => {
    const totalQty = event.ticketTypes.reduce((sum, ticket) => sum + ticket.quantity, 0);
    const totalSold = event.ticketTypes.reduce((sum, ticket) => sum + ticket.sold, 0);
    const grossRevenue = event.orders.reduce((sum, order) => sum + Number(order.total), 0);
    const netRevenue = event.orders.reduce((sum, order) => sum + Number(order.total) - Number(order.platformFee), 0);
    const allTickets = event.orders.flatMap((order) => order.tickets);
    const checkedIn = allTickets.filter((ticket) => ticket.isCheckedIn || Boolean(ticket.checkedInAt)).length;
    const checkinRate = allTickets.length > 0 ? Math.round((checkedIn / allTickets.length) * 100) : null;

    return {
      id: event.id,
      title: event.title,
      status: event.status,
      startAt: event.startAt,
      totalQty,
      totalSold,
      sellThrough: totalQty > 0 ? Math.round((totalSold / totalQty) * 100) : 0,
      grossRevenue: roundCurrency(grossRevenue),
      netRevenue: roundCurrency(netRevenue),
      checkinRate,
      paidOrders: event.orders.length,
    };
  });

  const monthMap: Record<string, { revenue: number; count: number; tickets: number }> = {};
  for (const order of recentOrders) {
    if (!order.paidAt) continue;
    const key = `${order.paidAt.getFullYear()}-${String(order.paidAt.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { revenue: 0, count: 0, tickets: 0 };
    monthMap[key].revenue += Number(order.total);
    monthMap[key].count += 1;
    monthMap[key].tickets += order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  const monthly: OrganizerAnalyticsData["monthly"] = [];
  for (let i = input.months - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly.push({
      month: key,
      label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      revenue: roundCurrency(monthMap[key]?.revenue ?? 0),
      count: monthMap[key]?.count ?? 0,
      tickets: monthMap[key]?.tickets ?? 0,
    });
  }

  const ticketTypeMap = new Map<string, { ticketTypeName: string; revenue: number; sold: number }>();
  for (const row of ticketTypeRows) {
    const key = row.ticketType.name;
    const existing = ticketTypeMap.get(key) ?? {
      ticketTypeName: key,
      revenue: 0,
      sold: 0,
    };
    existing.revenue += Number(row.subtotal);
    existing.sold += row.quantity;
    ticketTypeMap.set(key, existing);
  }

  const promoMap = new Map<string, { code: string; discount: number; orders: number }>();
  for (const order of promoOrders) {
    const code = order.promoCode?.code ?? "Unknown";
    const existing = promoMap.get(code) ?? { code, discount: 0, orders: 0 };
    existing.discount += Number(order.discountAmount);
    existing.orders += 1;
    promoMap.set(code, existing);
  }

  const addOnMap = new Map<string, { addOnName: string; revenue: number; quantity: number }>();
  for (const row of addOnRows) {
    const key = row.name;
    const existing = addOnMap.get(key) ?? { addOnName: key, revenue: 0, quantity: 0 };
    existing.revenue += Number(row.subtotal);
    existing.quantity += row.quantity;
    addOnMap.set(key, existing);
  }

  const affiliateMap = new Map<string, { code: string; label: string; orders: number; revenue: number }>();
  for (const order of affiliateOrders) {
    const code = order.affiliateLink?.code ?? "Unknown";
    const existing = affiliateMap.get(code) ?? {
      code,
      label: order.affiliateLink?.label ?? "Untitled",
      orders: 0,
      revenue: 0,
    };
    existing.orders += 1;
    existing.revenue += Number(order.total);
    affiliateMap.set(code, existing);
  }

  const dayMap = new Map<string, { date: string; revenue: number; orders: number }>();
  for (const order of recentDailyOrders) {
    if (!order.paidAt) continue;
    const key = order.paidAt.toISOString().slice(0, 10);
    const existing = dayMap.get(key) ?? { date: key, revenue: 0, orders: 0 };
    existing.revenue += Number(order.total);
    existing.orders += 1;
    dayMap.set(key, existing);
  }

  const totalGross = eventRows.reduce((sum, event) => sum + event.grossRevenue, 0);
  const totalNet = eventRows.reduce((sum, event) => sum + event.netRevenue, 0);
  const totalTicketsSold = eventRows.reduce((sum, event) => sum + event.totalSold, 0);
  const totalPaidOrders = eventRows.reduce((sum, event) => sum + event.paidOrders, 0);

  return {
    period: {
      months: input.months,
      eventId: eventFilter,
    },
    summary: {
      totalGross: roundCurrency(totalGross),
      totalNet: roundCurrency(totalNet),
      totalTicketsSold,
      totalPaidOrders,
    },
    monthly,
    topEvents: [...eventRows].sort((a, b) => b.grossRevenue - a.grossRevenue).slice(0, 5),
    events: eventRows.slice(0, 20),
    revenueByTicketType: [...ticketTypeMap.values()]
      .map((row) => ({ ...row, revenue: roundCurrency(row.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
    revenueByPromoCode: [...promoMap.values()]
      .map((row) => ({ ...row, discount: roundCurrency(row.discount) }))
      .sort((a, b) => b.orders - a.orders),
    revenueByAddOn: [...addOnMap.values()]
      .map((row) => ({ ...row, revenue: roundCurrency(row.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
    revenueByDay: [...dayMap.values()]
      .map((row) => ({ ...row, revenue: roundCurrency(row.revenue) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    affiliateStats: [...affiliateMap.values()]
      .map((row) => ({ ...row, revenue: roundCurrency(row.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
    reviewSummary: {
      averageRating: reviewAgg._count.id > 0 ? Number((reviewAgg._avg.rating ?? 0).toFixed(1)) : 0,
      totalReviews: reviewAgg._count.id ?? 0,
    },
  };
}
