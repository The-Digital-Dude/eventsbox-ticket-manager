import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrganizerApprovalStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import MonthlyReportForm from "@/app/admin/analytics/monthly-report-form";

export const revalidate = 0;

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/attendees", label: "Attendees" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

type AnalyticsPayload = {
  data?: {
    summary: {
      grossRevenue: number;
      platformFees: number;
      refunded: number;
      netRevenue: number;
      ticketsSold: number;
      ordersCount: number;
      refundsCount: number;
    };
    platformRevenue: number;
    platformCommission: number;
    topOrganizers: Array<{
      organizerId: string;
      brandName: string;
      revenue: number;
      events: number;
    }>;
    topEvents: Array<{
      eventId: string;
      title: string;
      revenue: number;
      ticketsSold: number;
    }>;
    revenueByCategory: Array<{
      categoryName: string;
      revenue: number;
      orders: number;
    }>;
    revenueByDay: Array<{
      date: string;
      revenue: number;
    }>;
    newOrganizersThisMonth: number;
    newAttendeesThisMonth: number;
    reviewStats: {
      totalReviews: number;
      averageRating: number;
    };
  };
};

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateInput(value?: string, fallback?: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function currentMonthInput() {
  const today = new Date();
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const sp = await searchParams;
  const from = parseDateInput(sp.from, defaultFrom) ?? defaultFrom;
  const to = parseDateInput(sp.to, now) ?? now;

  const cookieHeader = (await cookies()).toString();
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await fetch(`${env.APP_URL}/api/admin/analytics?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    redirect("/auth/login");
  }

  const organizers = await prisma.organizerProfile.findMany({
    where: {
      approvalStatus: OrganizerApprovalStatus.APPROVED,
    },
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
    orderBy: {
      createdAt: "desc",
    },
  });

  const organizerOptions = organizers
    .map((organizer) => ({
      id: organizer.id,
      label: organizer.brandName || organizer.companyName || organizer.user.email,
      email: organizer.user.email,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  const payload = (await res.json()) as AnalyticsPayload;
  const summary = payload.data?.summary ?? {
    grossRevenue: 0,
    platformFees: 0,
    refunded: 0,
    netRevenue: 0,
    ticketsSold: 0,
    ordersCount: 0,
    refundsCount: 0,
  };
  const platformRevenue = payload.data?.platformRevenue ?? 0;
  const platformCommission = payload.data?.platformCommission ?? 0;
  const topEvents = payload.data?.topEvents ?? [];
  const topOrganizers = payload.data?.topOrganizers ?? [];
  const revenueByCategory = payload.data?.revenueByCategory ?? [];
  const revenueByDay = payload.data?.revenueByDay ?? [];
  const reviewStats = payload.data?.reviewStats ?? {
    totalReviews: 0,
    averageRating: 0,
  };
  const newOrganizersThisMonth = payload.data?.newOrganizersThisMonth ?? 0;
  const newAttendeesThisMonth = payload.data?.newAttendeesThisMonth ?? 0;
  const maxRevenue = Math.max(...revenueByDay.map((entry) => entry.revenue), 1);

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader
        title="Financial Analytics"
        subtitle="Track platform revenue, top organizers, event performance, and monthly reporting from one place."
      />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" method="GET">
          <div className="space-y-2">
            <label htmlFor="from" className="text-sm font-medium text-neutral-700">
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={toDateInput(from)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="to" className="text-sm font-medium text-neutral-700">
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={toDateInput(to)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-11 rounded-xl bg-[var(--theme-accent)] px-6 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            Apply Range
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Platform Revenue", value: formatCurrency(platformRevenue), tone: "text-neutral-900" },
          { label: "Platform Commission", value: formatCurrency(platformCommission), tone: "text-[var(--theme-accent)]" },
          { label: "Net Revenue", value: formatCurrency(summary.netRevenue), tone: "text-emerald-700" },
          { label: "Platform Fees", value: formatCurrency(summary.platformFees), tone: "text-neutral-900" },
          { label: "Paid Orders", value: summary.ordersCount.toString(), tone: "text-neutral-900" },
          { label: "Tickets Sold", value: summary.ticketsSold.toString(), tone: "text-neutral-900" },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-neutral-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-semibold tracking-tight ${card.tone}`}>{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Refunded</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-amber-700">
            {formatCurrency(summary.refunded)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">{summary.refundsCount} refund{summary.refundsCount === 1 ? "" : "s"}</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">New Users This Month</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">
            {newOrganizersThisMonth + newAttendeesThisMonth}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {newOrganizersThisMonth} organizer{newOrganizersThisMonth === 1 ? "" : "s"}, {newAttendeesThisMonth} attendee{newAttendeesThisMonth === 1 ? "" : "s"}
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Review Stats</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">
            {reviewStats.totalReviews > 0 ? `★ ${reviewStats.averageRating.toFixed(1)}` : "No ratings"}
          </p>
          <p className="mt-1 text-sm text-neutral-500">{reviewStats.totalReviews} visible review{reviewStats.totalReviews === 1 ? "" : "s"}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Revenue by Day</h2>
              <p className="mt-1 text-sm text-neutral-500">Paid-order revenue grouped by payment day.</p>
            </div>
          </div>

          {revenueByDay.length === 0 ? (
            <p className="text-sm text-neutral-500">No paid orders in this range.</p>
          ) : (
            <div className="flex h-64 items-end gap-2 overflow-x-auto pb-2">
              {revenueByDay.map((entry) => {
                const height = `${Math.max(6, (entry.revenue / maxRevenue) * 100)}%`;
                return (
                  <div key={entry.date} className="group flex min-w-[44px] flex-1 flex-col items-center gap-2">
                    <div className="relative flex h-full w-full items-end">
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm group-hover:block">
                        <p className="font-semibold text-neutral-900">{formatCurrency(entry.revenue)}</p>
                        <p className="text-neutral-500">{entry.date}</p>
                      </div>
                      <div className="w-full rounded-t-xl bg-[var(--theme-accent)]" style={{ height }} />
                    </div>
                    <span className="text-[10px] text-neutral-400">{entry.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Snapshot</h2>
          <div className="mt-6 grid gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
              <p className="text-sm text-neutral-500">Gross revenue in range</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{formatCurrency(summary.grossRevenue)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
              <p className="text-sm text-neutral-500">Average order value</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">
                {summary.ordersCount > 0 ? formatCurrency(summary.grossRevenue / summary.ordersCount) : formatCurrency(0)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
              <p className="text-sm text-neutral-500">Commission share of revenue</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">
                {platformRevenue > 0 ? `${((platformCommission / platformRevenue) * 100).toFixed(1)}%` : "0.0%"}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-lg font-semibold text-neutral-900">Top Organizers</h2>
          </div>
          {topOrganizers.length === 0 ? (
            <div className="px-6 py-8 text-sm text-neutral-500">No organizer revenue data available for this range.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3">Organizer</th>
                    <th className="px-4 py-3 text-right">Events</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {topOrganizers.map((organizer) => (
                    <tr key={organizer.organizerId}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{organizer.brandName}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">{organizer.events}</td>
                      <td className="px-4 py-3 text-right text-neutral-900">{formatCurrency(organizer.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-lg font-semibold text-neutral-900">Revenue by Category</h2>
          </div>
          {revenueByCategory.length === 0 ? (
            <div className="px-6 py-8 text-sm text-neutral-500">No category revenue data available for this range.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {revenueByCategory.map((row) => (
                    <tr key={row.categoryName}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{row.categoryName}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">{row.orders}</td>
                      <td className="px-4 py-3 text-right text-neutral-900">{formatCurrency(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">Top Events</h2>
        </div>
        {topEvents.length === 0 ? (
          <div className="px-6 py-8 text-sm text-neutral-500">No revenue data available for this range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3 text-right">Tickets Sold</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {topEvents.map((event) => (
                  <tr key={event.eventId}>
                    <td className="px-4 py-3 font-medium text-neutral-900">{event.title}</td>
                    <td className="px-4 py-3 text-right text-neutral-600">{event.ticketsSold}</td>
                    <td className="px-4 py-3 text-right text-neutral-900">{formatCurrency(event.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MonthlyReportForm organizers={organizerOptions} defaultMonth={currentMonthInput()} />
    </SidebarLayout>
  );
}
