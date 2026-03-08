import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizerApprovalStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Badge } from "@/src/components/ui/badge";

export const revalidate = 60;

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

function parseMonths(raw?: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 12;
  if ([3, 6, 12, 24].includes(value)) return value;
  return 12;
}

function statusBadgeClass(status: string) {
  if (status === "PUBLISHED") return "bg-emerald-100 text-emerald-700 border-transparent";
  if (status === "PENDING_APPROVAL") return "bg-amber-100 text-amber-700 border-transparent";
  if (status === "REJECTED") return "bg-red-100 text-red-700 border-transparent";
  if (status === "CANCELLED") return "bg-orange-100 text-orange-700 border-transparent";
  return "bg-neutral-100 text-neutral-600 border-transparent";
}

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function pctDelta(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export default async function OrganizerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") redirect("/auth/login");

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, approvalStatus: true },
  });
  if (!profile || profile.approvalStatus !== OrganizerApprovalStatus.APPROVED) {
    redirect("/organizer/status");
  }

  const { months: rawMonths } = await searchParams;
  const months = parseMonths(rawMonths);

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

  const eventRows = events.map((event) => {
    const totalQty = event.ticketTypes.reduce((sum, ticket) => sum + ticket.quantity, 0);
    const totalSold = event.ticketTypes.reduce((sum, ticket) => sum + ticket.sold, 0);
    const grossRevenue = event.orders.reduce((sum, order) => sum + Number(order.total), 0);
    const netRevenue = event.orders.reduce(
      (sum, order) => sum + Number(order.total) - Number(order.platformFee),
      0,
    );
    const allTickets = event.orders.flatMap((order) => order.tickets);
    const checkedIn = allTickets.filter((ticket) => ticket.checkedInAt).length;
    const checkinRate = allTickets.length > 0 ? Math.round((checkedIn / allTickets.length) * 100) : null;

    return {
      id: event.id,
      title: event.title,
      status: event.status,
      startAt: event.startAt,
      totalQty,
      totalSold,
      sellThrough: totalQty > 0 ? Math.round((totalSold / totalQty) * 100) : 0,
      grossRevenue,
      netRevenue,
      checkinRate,
      paidOrders: event.orders.length,
    };
  });

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

  const monthMap: Record<string, { revenue: number; count: number; tickets: number }> = {};
  for (const order of recentOrders) {
    if (!order.paidAt) continue;
    const key = `${order.paidAt.getFullYear()}-${String(order.paidAt.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { revenue: 0, count: 0, tickets: 0 };
    monthMap[key].revenue += Number(order.total);
    monthMap[key].count += 1;
    monthMap[key].tickets += order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  const monthly = Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    const date = new Date();
    date.setMonth(date.getMonth() - offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: date.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      revenue: parseFloat((monthMap[key]?.revenue ?? 0).toFixed(2)),
      count: monthMap[key]?.count ?? 0,
      tickets: monthMap[key]?.tickets ?? 0,
    };
  });

  const maxRevenue = Math.max(...monthly.map((month) => month.revenue), 1);
  const maxTickets = Math.max(...monthly.map((month) => month.tickets), 1);

  const totalGross = eventRows.reduce((sum, event) => sum + event.grossRevenue, 0);
  const totalNet = eventRows.reduce((sum, event) => sum + event.netRevenue, 0);
  const totalSold = eventRows.reduce((sum, event) => sum + event.totalSold, 0);
  const totalPaidOrders = eventRows.reduce((sum, event) => sum + event.paidOrders, 0);

  const topEvents = [...eventRows]
    .sort((a, b) => b.grossRevenue - a.grossRevenue)
    .slice(0, 5);

  const currentMonth = monthly.at(-1);
  const previousMonth = monthly.at(-2);
  const revenueDelta = pctDelta(currentMonth?.revenue ?? 0, previousMonth?.revenue ?? 0);
  const ticketsDelta = pctDelta(currentMonth?.tickets ?? 0, previousMonth?.tickets ?? 0);

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Analytics" subtitle="Revenue and ticket sales trends across your event portfolio." />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-1 text-sm text-neutral-500">Period:</p>
          {[3, 6, 12, 24].map((period) => {
            const active = months === period;
            return (
              <Link
                key={period}
                href={`/organizer/analytics?months=${period}`}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-[var(--theme-accent)] text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                Last {period}m
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Gross Revenue</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">${totalGross.toFixed(2)}</p>
          <p className="mt-1 text-xs text-neutral-400">All-time paid orders</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Net Revenue</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">${totalNet.toFixed(2)}</p>
          <p className="mt-1 text-xs text-neutral-400">After platform fees</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Tickets Sold</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">{totalSold}</p>
          <p className="mt-1 text-xs text-neutral-400">Across all events</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Paid Orders</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">{totalPaidOrders}</p>
          <p className="mt-1 text-xs text-neutral-400">Successful checkouts</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Monthly Revenue</h2>
            {revenueDelta !== null && (
              <Badge className={revenueDelta >= 0 ? "bg-emerald-100 text-emerald-700 border-transparent" : "bg-red-100 text-red-700 border-transparent"}>
                {revenueDelta >= 0 ? "+" : ""}
                {revenueDelta.toFixed(1)}% vs last month
              </Badge>
            )}
          </div>
          <div className="flex h-52 items-end gap-1.5">
            {monthly.map((month) => {
              const heightPct = (month.revenue / maxRevenue) * 100;
              return (
                <div key={month.key} className="group relative flex flex-1 flex-col items-center gap-1">
                  <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-md group-hover:block whitespace-nowrap z-10">
                    <p className="font-semibold text-neutral-900">${month.revenue.toFixed(2)}</p>
                    <p className="text-neutral-500">{month.count} order{month.count !== 1 ? "s" : ""}</p>
                  </div>
                  <div
                    className="w-full rounded-t-md bg-[var(--theme-accent)] transition-all duration-300"
                    style={{ height: `${Math.max(heightPct, month.revenue > 0 ? 4 : 0)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5">
            {monthly.map((month) => (
              <div key={month.key} className="flex-1 truncate text-center text-[10px] text-neutral-400">{month.label}</div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Monthly Tickets Sold</h2>
            {ticketsDelta !== null && (
              <Badge className={ticketsDelta >= 0 ? "bg-emerald-100 text-emerald-700 border-transparent" : "bg-red-100 text-red-700 border-transparent"}>
                {ticketsDelta >= 0 ? "+" : ""}
                {ticketsDelta.toFixed(1)}% vs last month
              </Badge>
            )}
          </div>
          <div className="flex h-52 items-end gap-1.5">
            {monthly.map((month) => {
              const heightPct = (month.tickets / maxTickets) * 100;
              return (
                <div key={month.key} className="group relative flex flex-1 flex-col items-center gap-1">
                  <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-md group-hover:block whitespace-nowrap z-10">
                    <p className="font-semibold text-neutral-900">{month.tickets} tickets</p>
                    <p className="text-neutral-500">{month.count} paid order{month.count !== 1 ? "s" : ""}</p>
                  </div>
                  <div
                    className="w-full rounded-t-md bg-emerald-500 transition-all duration-300"
                    style={{ height: `${Math.max(heightPct, month.tickets > 0 ? 4 : 0)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5">
            {monthly.map((month) => (
              <div key={month.key} className="flex-1 truncate text-center text-[10px] text-neutral-400">{month.label}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Top Revenue Events</h2>
          {topEvents.length === 0 ? (
            <p className="text-sm text-neutral-500">No events with paid orders yet.</p>
          ) : (
            <div className="space-y-3">
              {topEvents.map((event, idx) => (
                <div key={event.id} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-medium text-neutral-900">{idx + 1}. {event.title}</p>
                    <Badge className={statusBadgeClass(event.status)}>{event.status.replace("_", " ")}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-neutral-500">
                    <div>
                      <p>Gross</p>
                      <p className="font-semibold text-neutral-900">${event.grossRevenue.toFixed(2)}</p>
                    </div>
                    <div>
                      <p>Tickets</p>
                      <p className="font-semibold text-neutral-900">{event.totalSold}</p>
                    </div>
                    <div>
                      <p>Orders</p>
                      <p className="font-semibold text-neutral-900">{event.paidOrders}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Period Snapshot</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p className="text-xs text-neutral-500">Revenue in period</p>
              <p className="text-xl font-semibold text-neutral-900">
                ${monthly.reduce((sum, month) => sum + month.revenue, 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p className="text-xs text-neutral-500">Tickets sold in period</p>
              <p className="text-xl font-semibold text-neutral-900">
                {monthly.reduce((sum, month) => sum + month.tickets, 0)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p className="text-xs text-neutral-500">Paid orders in period</p>
              <p className="text-xl font-semibold text-neutral-900">
                {monthly.reduce((sum, month) => sum + month.count, 0)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p className="text-xs text-neutral-500">Average order value</p>
              <p className="text-xl font-semibold text-neutral-900">
                ${(() => {
                  const revenue = monthly.reduce((sum, month) => sum + month.revenue, 0);
                  const orders = monthly.reduce((sum, month) => sum + month.count, 0);
                  return orders > 0 ? (revenue / orders).toFixed(2) : "0.00";
                })()}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">Event Breakdown</h2>
          <p className="text-sm text-neutral-400">Top 20 by start date</p>
        </div>
        {eventRows.length === 0 ? (
          <p className="px-6 py-8 text-sm text-neutral-400">No events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-neutral-400">
                  <th className="px-6 py-3">Event</th>
                  <th className="px-4 py-3 text-right">Tickets</th>
                  <th className="px-4 py-3 text-right">Sell-through</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3 text-right">Check-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {eventRows.slice(0, 20).map((event) => (
                  <tr key={event.id} className="transition hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="leading-snug font-medium text-neutral-900">{event.title}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={statusBadgeClass(event.status)}>{event.status.replace("_", " ")}</Badge>
                          <span className="text-xs text-neutral-400">{fmtDate(event.startAt)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums text-neutral-700">
                      {event.totalSold}/{event.totalQty}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="tabular-nums text-neutral-700">{event.sellThrough}%</span>
                        <div className="h-1.5 w-16 rounded-full bg-neutral-100">
                          <div className="h-full rounded-full bg-[var(--theme-accent)]" style={{ width: `${event.sellThrough}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums text-neutral-700">${event.grossRevenue.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right tabular-nums font-medium text-emerald-700">${event.netRevenue.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right">
                      {event.checkinRate === null ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="tabular-nums text-neutral-700">{event.checkinRate}%</span>
                          <div className="h-1.5 w-16 rounded-full bg-neutral-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${event.checkinRate}%` }} />
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </SidebarLayout>
  );
}
