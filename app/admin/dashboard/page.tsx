import { redirect } from "next/navigation";
import { Building2, CalendarDays, DollarSign, Store, Ticket, Users } from "lucide-react";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import Link from "next/link";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

export const revalidate = 60;

export default async function AdminDashboardPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const [
    organizerCounts,
    eventCounts,
    venueCounts,
    orderStats,
    payoutStats,
    recentOrders,
  ] = await Promise.all([
    prisma.organizerProfile.groupBy({ by: ["approvalStatus"], _count: true }),
    prisma.event.groupBy({ by: ["status"], _count: true }),
    prisma.venue.groupBy({ by: ["status"], _count: true }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { total: true }, _count: true }),
    prisma.payoutRequest.groupBy({ by: ["status"], _count: true }),
    prisma.order.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 8,
      select: {
        id: true,
        buyerName: true,
        buyerEmail: true,
        total: true,
        paidAt: true,
        event: { select: { title: true, slug: true } },
      },
    }),
  ]);

  const totalOrganizers = organizerCounts.reduce((s, r) => s + r._count, 0);
  const approvedOrganizers = organizerCounts.find((r) => r.approvalStatus === "APPROVED")?._count ?? 0;
  const pendingOrganizers = organizerCounts.find((r) => r.approvalStatus === "PENDING_APPROVAL")?._count ?? 0;

  const publishedEvents = eventCounts.find((r) => r.status === "PUBLISHED")?._count ?? 0;
  const pendingEvents = eventCounts.find((r) => r.status === "PENDING_APPROVAL")?._count ?? 0;
  const totalEvents = eventCounts.reduce((s, r) => s + r._count, 0);

  const approvedVenues = venueCounts.find((r) => r.status === "APPROVED")?._count ?? 0;
  const totalVenues = venueCounts.reduce((s, r) => s + r._count, 0);

  const grossRevenue = Number(orderStats._sum.total ?? 0);
  const totalOrders = orderStats._count;

  const pendingPayouts = payoutStats.find((r) => r.status === "PENDING")?._count ?? 0;

  function formatDateTime(iso: Date | string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Control Center" subtitle="Platform-wide overview" />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Organizers</p>
            <Users className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{totalOrganizers}</p>
          <p className="mt-1 text-xs text-neutral-500">{approvedOrganizers} approved · {pendingOrganizers} pending</p>
          <Link href="/admin/organizers" className="mt-3 inline-block text-xs text-[var(--theme-accent)] underline underline-offset-4">
            Manage →
          </Link>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Events</p>
            <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{totalEvents}</p>
          <p className="mt-1 text-xs text-neutral-500">{publishedEvents} live · {pendingEvents} pending review</p>
          {pendingEvents > 0 && (
            <Link href="/admin/events" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
              {pendingEvents} need review
            </Link>
          )}
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Venues</p>
            <Store className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{totalVenues}</p>
          <p className="mt-1 text-xs text-neutral-500">{approvedVenues} approved</p>
          <Link href="/admin/venues" className="mt-3 inline-block text-xs text-[var(--theme-accent)] underline underline-offset-4">
            Manage →
          </Link>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Gross Revenue</p>
            <DollarSign className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">${grossRevenue.toFixed(2)}</p>
          <p className="mt-1 text-xs text-neutral-500">From {totalOrders} paid orders</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Tickets Issued</p>
            <Ticket className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{totalOrders}</p>
          <p className="mt-1 text-xs text-neutral-500">From paid orders</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Payout Requests</p>
            <Building2 className="h-4 w-4 text-[var(--theme-accent)]" />
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{pendingPayouts}</p>
          <p className="mt-1 text-xs text-neutral-500">pending review</p>
          {pendingPayouts > 0 && (
            <Link href="/admin/payouts" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
              Review payouts
            </Link>
          )}
        </article>
      </div>

      {/* Recent orders */}
      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-neutral-900">Recent Orders</h2>
          <span className="text-sm text-neutral-500">{recentOrders.length} shown</span>
        </div>
        {recentOrders.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-400">No paid orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Buyer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Paid At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{order.buyerName}</p>
                      <p className="text-xs text-neutral-500">{order.buyerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 truncate max-w-[200px]">{order.event.title}</td>
                    <td className="px-4 py-3 font-semibold text-neutral-900">${Number(order.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{formatDateTime(order.paidAt)}</td>
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
