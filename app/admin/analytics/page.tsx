import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";

export const revalidate = 60;

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminAnalyticsPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/auth/login");

  // Monthly revenue (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [recentOrders, topEvents, topOrganizers, allTimeStats] = await Promise.all([
    prisma.order.findMany({
      where: { status: "PAID", paidAt: { gte: twelveMonthsAgo } },
      select: { total: true, platformFee: true, gst: true, paidAt: true },
    }),
    // Top events by revenue
    prisma.event.findMany({
      where: { orders: { some: { status: "PAID" } } },
      include: {
        _count: { select: { orders: true } },
        orders: {
          where: { status: "PAID" },
          select: { total: true, platformFee: true },
        },
        organizerProfile: { select: { companyName: true, brandName: true, user: { select: { email: true } } } },
      },
      orderBy: { orders: { _count: "desc" } },
      take: 10,
    }),
    // Top organizers by revenue
    prisma.organizerProfile.findMany({
      include: {
        user: { select: { email: true } },
        events: {
          include: {
            orders: {
              where: { status: "PAID" },
              select: { total: true, platformFee: true },
            },
          },
        },
      },
      take: 10,
    }),
    // All-time stats
    prisma.order.aggregate({
      where: { status: "PAID" },
      _sum: { total: true, platformFee: true, gst: true },
      _count: true,
    }),
  ]);

  // Monthly grouping
  const monthMap: Record<string, { revenue: number; platformFee: number; count: number }> = {};
  for (const order of recentOrders) {
    if (!order.paidAt) continue;
    const key = `${order.paidAt.getFullYear()}-${String(order.paidAt.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { revenue: 0, platformFee: 0, count: 0 };
    monthMap[key].revenue += Number(order.total);
    monthMap[key].platformFee += Number(order.platformFee);
    monthMap[key].count += 1;
  }

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    return { key, label, revenue: monthMap[key]?.revenue ?? 0, platformFee: monthMap[key]?.platformFee ?? 0, count: monthMap[key]?.count ?? 0 };
  });

  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  // Per-event computed stats
  const eventRows = topEvents.map((e: typeof topEvents[number]) => {
    const gross = e.orders.reduce((s: number, o) => s + Number(o.total), 0);
    const fees = e.orders.reduce((s: number, o) => s + Number(o.platformFee), 0);
    const orgName = e.organizerProfile.brandName ?? e.organizerProfile.companyName ?? e.organizerProfile.user.email;
    return { id: e.id, title: e.title, status: e.status, gross, fees, orders: e._count.orders, orgName };
  }).sort((a, b) => b.gross - a.gross);

  // Per-organizer computed stats
  const orgRows = topOrganizers.map((org: typeof topOrganizers[number]) => {
    const allOrders = org.events.flatMap((e) => e.orders);
    const gross = allOrders.reduce((s: number, o) => s + Number(o.total), 0);
    const fees = allOrders.reduce((s: number, o) => s + Number(o.platformFee), 0);
    const name = org.brandName ?? org.companyName ?? org.user.email;
    return { id: org.id, name, gross, fees, events: org.events.length, orders: allOrders.length };
  }).sort((a, b) => b.gross - a.gross).slice(0, 8);

  const allTimeGross = Number(allTimeStats._sum.total ?? 0);
  const allTimeFees = Number(allTimeStats._sum.platformFee ?? 0);
  const allTimeGst = Number(allTimeStats._sum.gst ?? 0);
  const allTimeOrders = allTimeStats._count;

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Platform Analytics" subtitle="Revenue, order trends, and top performers across the platform." />

      {/* KPI row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Gross Revenue", value: `$${allTimeGross.toFixed(2)}`, sub: "All-time paid orders" },
          { label: "Platform Fees", value: `$${allTimeFees.toFixed(2)}`, sub: "Commission collected" },
          { label: "GST Collected", value: `$${allTimeGst.toFixed(2)}`, sub: "Tax on all sales" },
          { label: "Total Orders", value: allTimeOrders.toString(), sub: "Paid orders all-time" },
        ].map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-neutral-500">{kpi.label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">{kpi.value}</p>
            <p className="mt-1 text-xs text-neutral-400">{kpi.sub}</p>
          </article>
        ))}
      </section>

      {/* Monthly Revenue Chart */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-neutral-900">Monthly Revenue (Last 12 Months)</h2>
        <div className="flex h-52 items-end gap-1.5">
          {monthly.map((m) => {
            const heightPct = (m.revenue / maxRevenue) * 100;
            return (
              <div key={m.key} className="group relative flex flex-1 flex-col items-center gap-1">
                <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-md group-hover:block whitespace-nowrap z-10">
                  <p className="font-semibold text-neutral-900">${m.revenue.toFixed(2)}</p>
                  <p className="text-neutral-500">${m.platformFee.toFixed(2)} fees</p>
                  <p className="text-neutral-400">{m.count} order{m.count !== 1 ? "s" : ""}</p>
                </div>
                {/* Stacked: fees (lighter) on top of net */}
                <div className="flex w-full flex-col items-center justify-end" style={{ height: `${Math.max(heightPct, m.revenue > 0 ? 4 : 0)}%` }}>
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${m.revenue > 0 ? (m.platformFee / m.revenue) * 100 : 0}%`, background: "rgb(var(--theme-accent-rgb)/0.4)" }}
                  />
                  <div
                    className="w-full"
                    style={{ height: `${m.revenue > 0 ? ((m.revenue - m.platformFee) / m.revenue) * 100 : 0}%`, background: "var(--theme-accent)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1.5">
          {monthly.map((m) => (
            <div key={m.key} className="flex-1 text-center text-[10px] text-neutral-400 truncate">{m.label}</div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--theme-accent)]" />Net to organizer</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[rgb(var(--theme-accent-rgb)/0.4)]" />Platform fees</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top events */}
        <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-lg font-semibold text-neutral-900">Top Events by Revenue</h2>
          </div>
          {eventRows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-400">No paid events yet.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {eventRows.map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50">
                  <span className="w-5 text-center text-sm font-semibold text-neutral-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{e.title}</p>
                    <p className="text-xs text-neutral-500">{e.orgName} · {e.orders} orders</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-neutral-900">${e.gross.toFixed(2)}</p>
                    <p className="text-xs text-[var(--theme-accent)]">${e.fees.toFixed(2)} fees</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top organizers */}
        <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-lg font-semibold text-neutral-900">Top Organizers by Revenue</h2>
          </div>
          {orgRows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-400">No organizers with paid events yet.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {orgRows.map((org, i) => (
                <div key={org.id} className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50">
                  <span className="w-5 text-center text-sm font-semibold text-neutral-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{org.name}</p>
                    <p className="text-xs text-neutral-500">{org.events} events · {org.orders} orders</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-neutral-900">${org.gross.toFixed(2)}</p>
                    <p className="text-xs text-[var(--theme-accent)]">${org.fees.toFixed(2)} fees</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Monthly table */}
      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">Monthly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-neutral-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Month</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-400">Orders</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-400">Gross Revenue</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-400">Platform Fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {[...monthly].reverse().map((m) => (
                <tr key={m.key} className="hover:bg-neutral-50">
                  <td className="px-5 py-3 font-medium text-neutral-900">{m.label}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-neutral-600">{m.count}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-neutral-900">${m.revenue.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-[var(--theme-accent)]">${m.platformFee.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-neutral-400">
        Data as of {fmtDate(new Date())}. Refreshes every 60 seconds.
      </p>
    </SidebarLayout>
  );
}
