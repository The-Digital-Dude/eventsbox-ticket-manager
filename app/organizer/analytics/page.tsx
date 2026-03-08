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

export default async function OrganizerAnalyticsPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") redirect("/auth/login");

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, approvalStatus: true },
  });
  if (!profile || profile.approvalStatus !== OrganizerApprovalStatus.APPROVED) {
    redirect("/organizer/status");
  }

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
      grossRevenue,
      netRevenue,
      checkinRate,
      paidOrders: e.orders.length,
    };
  });

  // Monthly revenue (last 12 months)
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

  const monthMap: Record<string, { revenue: number; count: number }> = {};
  for (const order of recentOrders) {
    if (!order.paidAt) continue;
    const key = `${order.paidAt.getFullYear()}-${String(order.paidAt.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { revenue: 0, count: 0 };
    monthMap[key].revenue += Number(order.total);
    monthMap[key].count += 1;
  }

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    return { key, label, revenue: monthMap[key]?.revenue ?? 0, count: monthMap[key]?.count ?? 0 };
  });

  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);
  const totalGross = eventRows.reduce((s, e) => s + e.grossRevenue, 0);
  const totalNet = eventRows.reduce((s, e) => s + e.netRevenue, 0);
  const totalSold = eventRows.reduce((s, e) => s + e.totalSold, 0);

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Analytics" subtitle="Revenue, ticket sales, and check-in rates across your events." />

      {/* Summary KPIs */}
      <section className="grid gap-4 sm:grid-cols-3">
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
      </section>

      {/* Monthly Revenue Chart */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-neutral-900">Monthly Revenue</h2>
        <div className="flex h-48 items-end gap-1.5">
          {monthly.map((m) => {
            const heightPct = (m.revenue / maxRevenue) * 100;
            return (
              <div key={m.key} className="group relative flex flex-1 flex-col items-center gap-1">
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-md group-hover:block whitespace-nowrap z-10">
                  <p className="font-semibold text-neutral-900">${m.revenue.toFixed(2)}</p>
                  <p className="text-neutral-500">{m.count} order{m.count !== 1 ? "s" : ""}</p>
                </div>
                <div
                  className="w-full rounded-t-md bg-[var(--theme-accent)] transition-all duration-300"
                  style={{ height: `${Math.max(heightPct, m.revenue > 0 ? 4 : 0)}%` }}
                />
              </div>
            );
          })}
        </div>
        {/* X-axis labels */}
        <div className="mt-2 flex gap-1.5">
          {monthly.map((m) => (
            <div key={m.key} className="flex-1 text-center text-[10px] text-neutral-400 truncate">{m.label}</div>
          ))}
        </div>
      </section>

      {/* Per-event table */}
      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">Event Breakdown</h2>
          <p className="text-sm text-neutral-400">Last 20 events</p>
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
                {eventRows.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-neutral-900 leading-snug">{e.title}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={statusBadgeClass(e.status)}>{e.status.replace("_", " ")}</Badge>
                          <span className="text-xs text-neutral-400">{fmtDate(e.startAt)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums text-neutral-700">
                      {e.totalSold}/{e.totalQty}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="tabular-nums text-neutral-700">{e.sellThrough}%</span>
                        <div className="h-1.5 w-16 rounded-full bg-neutral-100">
                          <div
                            className="h-full rounded-full bg-[var(--theme-accent)]"
                            style={{ width: `${e.sellThrough}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums text-neutral-700">${e.grossRevenue.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right tabular-nums font-medium text-emerald-700">${e.netRevenue.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right">
                      {e.checkinRate === null ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="tabular-nums text-neutral-700">{e.checkinRate}%</span>
                          <div className="h-1.5 w-16 rounded-full bg-neutral-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${e.checkinRate}%` }}
                            />
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
