import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrganizerApprovalStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Badge } from "@/src/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";

export const revalidate = 0;

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
  { href: "/organizer/affiliate", label: "Affiliate Links" },
  { href: "/organizer/cancellation-requests", label: "Cancellations" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

type AnalyticsPayload = {
  data?: {
    period: { months: number; eventId: string | null };
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
      startAt: string;
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
      startAt: string;
      totalQty: number;
      totalSold: number;
      sellThrough: number;
      grossRevenue: number;
      netRevenue: number;
      checkinRate: number | null;
      paidOrders: number;
    }>;
    revenueByTicketType: Array<{ ticketTypeName: string; revenue: number; sold: number }>;
    revenueByPromoCode: Array<{ code: string; discount: number; orders: number }>;
    revenueByAddOn: Array<{ addOnName: string; revenue: number; quantity: number }>;
    revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
    affiliateStats: Array<{ code: string; label: string; orders: number; revenue: number }>;
    reviewSummary: { averageRating: number; totalReviews: number };
  };
};

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

function fmtDate(input: string) {
  return new Date(input).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function pctDelta(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function EmptyTable({ label }: { label: string }) {
  return <p className="text-sm text-neutral-500">{label}</p>;
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
    select: { approvalStatus: true },
  });
  if (!profile || profile.approvalStatus !== OrganizerApprovalStatus.APPROVED) {
    redirect("/organizer/status");
  }

  const { months: rawMonths } = await searchParams;
  const months = parseMonths(rawMonths);

  const cookieHeader = (await cookies()).toString();
  const params = new URLSearchParams({ months: String(months) });
  const res = await fetch(`${env.APP_URL}/api/organizer/analytics?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    redirect("/auth/login");
  }

  const payload = (await res.json()) as AnalyticsPayload;
  const data = payload.data;
  if (!data) {
    redirect("/organizer/dashboard");
  }

  const monthly = data.monthly;
  const maxRevenue = Math.max(...monthly.map((month) => month.revenue), 1);
  const maxTickets = Math.max(...monthly.map((month) => month.tickets), 1);
  const currentMonth = monthly.at(-1);
  const previousMonth = monthly.at(-2);
  const revenueDelta = pctDelta(currentMonth?.revenue ?? 0, previousMonth?.revenue ?? 0);
  const ticketsDelta = pctDelta(currentMonth?.tickets ?? 0, previousMonth?.tickets ?? 0);
  const exportFrom = new Date();
  exportFrom.setMonth(exportFrom.getMonth() - months);
  const exportTo = new Date();

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Analytics" subtitle="Revenue, promo, add-on, affiliate, and review trends across your event portfolio." />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-1 text-sm text-neutral-500">Period:</p>
            {[3, 6, 12, 24].map((period) => {
              const active = months === period;
              return (
                <Link
                  key={period}
                  href={`/organizer/analytics?months=${period}`}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    active ? "bg-[var(--theme-accent)] text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  Last {period}m
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/api/organizer/analytics/export?months=${months}&type=orders`}
              className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Export Overview
            </Link>
            <Link
              href={`/api/organizer/analytics/export?months=${months}&type=ticket-types`}
              className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Export Ticket Types
            </Link>
            <Link
              href={`/api/organizer/export/orders?from=${encodeURIComponent(exportFrom.toISOString())}&to=${encodeURIComponent(exportTo.toISOString())}`}
              className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Export All Orders (CSV)
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Gross Revenue</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">${data.summary.totalGross.toFixed(2)}</p>
          <p className="mt-1 text-xs text-neutral-400">All-time paid orders</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Net Revenue</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">${data.summary.totalNet.toFixed(2)}</p>
          <p className="mt-1 text-xs text-neutral-400">After platform fees</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Tickets Sold</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">{data.summary.totalTicketsSold}</p>
          <p className="mt-1 text-xs text-neutral-400">Across all events</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Reviews</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">{data.reviewSummary.totalReviews}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {data.reviewSummary.totalReviews > 0 ? `Average ★ ${data.reviewSummary.averageRating.toFixed(1)}` : "No visible reviews yet"}
          </p>
        </article>
      </section>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ticket-types">By Ticket Type</TabsTrigger>
          <TabsTrigger value="promo-codes">Promo Codes</TabsTrigger>
          <TabsTrigger value="revenue-over-time">Revenue Over Time</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
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
                    <div key={month.month} className="group relative flex flex-1 flex-col items-center gap-1">
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
                  <div key={month.month} className="flex-1 truncate text-center text-[10px] text-neutral-400">{month.label}</div>
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
                    <div key={month.month} className="group relative flex flex-1 flex-col items-center gap-1">
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
                  <div key={month.month} className="flex-1 truncate text-center text-[10px] text-neutral-400">{month.label}</div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-neutral-900">Top Revenue Events</h2>
              {data.topEvents.length === 0 ? (
                <EmptyTable label="No events with paid orders yet." />
              ) : (
                <div className="space-y-3">
                  {data.topEvents.map((event, idx) => (
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
                  <p className="text-xl font-semibold text-neutral-900">{monthly.reduce((sum, month) => sum + month.tickets, 0)}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] p-3">
                  <p className="text-xs text-neutral-500">Paid orders in period</p>
                  <p className="text-xl font-semibold text-neutral-900">{monthly.reduce((sum, month) => sum + month.count, 0)}</p>
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
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
                <p className="text-sm font-medium text-neutral-700">Review Summary</p>
                <p className="mt-2 text-2xl font-semibold text-neutral-900">
                  {data.reviewSummary.totalReviews > 0 ? `★ ${data.reviewSummary.averageRating.toFixed(1)}` : "No reviews yet"}
                </p>
                <p className="text-sm text-neutral-500">{data.reviewSummary.totalReviews} visible review{data.reviewSummary.totalReviews === 1 ? "" : "s"}</p>
              </div>
            </article>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-semibold text-neutral-900">Event Breakdown</h2>
              <p className="text-sm text-neutral-400">Top 20 by start date</p>
            </div>
            {data.events.length === 0 ? (
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
                    {data.events.map((event) => (
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
                        <td className="px-4 py-4 text-right tabular-nums text-neutral-700">{event.totalSold}/{event.totalQty}</td>
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

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-neutral-900">Affiliate Stats</h2>
              {data.affiliateStats.length === 0 ? (
                <EmptyTable label="No affiliate-linked orders yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                      <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Label</th>
                        <th className="px-4 py-3 text-right">Orders</th>
                        <th className="px-4 py-3 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.affiliateStats.map((entry) => (
                        <tr key={entry.code}>
                          <td className="px-4 py-3 font-medium text-neutral-900">{entry.code}</td>
                          <td className="px-4 py-3 text-neutral-600">{entry.label}</td>
                          <td className="px-4 py-3 text-right text-neutral-600">{entry.orders}</td>
                          <td className="px-4 py-3 text-right text-neutral-900">${entry.revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-neutral-900">Review Summary</h2>
              <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-5">
                <p className="text-sm text-neutral-500">Visible average rating</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900">
                  {data.reviewSummary.totalReviews > 0 ? `★ ${data.reviewSummary.averageRating.toFixed(1)}` : "—"}
                </p>
                <p className="mt-2 text-sm text-neutral-600">{data.reviewSummary.totalReviews} total review{data.reviewSummary.totalReviews === 1 ? "" : "s"}</p>
              </div>
            </article>
          </section>
        </TabsContent>

        <TabsContent value="ticket-types" className="mt-4">
          <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-semibold text-neutral-900">Revenue by Ticket Type</h2>
              <Link href={`/api/organizer/analytics/export?months=${months}&type=ticket-types`} className="text-sm font-medium text-[var(--theme-accent)] hover:underline">
                Export CSV
              </Link>
            </div>
            {data.revenueByTicketType.length === 0 ? (
              <p className="px-6 py-8 text-sm text-neutral-500">No paid ticket sales yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-3">Ticket Type</th>
                      <th className="px-4 py-3 text-right">Units Sold</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {data.revenueByTicketType.map((row) => (
                      <tr key={row.ticketTypeName}>
                        <td className="px-4 py-3 font-medium text-neutral-900">{row.ticketTypeName}</td>
                        <td className="px-4 py-3 text-right text-neutral-600">{row.sold}</td>
                        <td className="px-4 py-3 text-right text-neutral-900">${row.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="promo-codes" className="mt-4">
          <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-semibold text-neutral-900">Revenue by Promo Code</h2>
              <Link href={`/api/organizer/analytics/export?months=${months}&type=promo-codes`} className="text-sm font-medium text-[var(--theme-accent)] hover:underline">
                Export CSV
              </Link>
            </div>
            {data.revenueByPromoCode.length === 0 ? (
              <p className="px-6 py-8 text-sm text-neutral-500">No promo-code orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3 text-right">Orders</th>
                      <th className="px-4 py-3 text-right">Discount Applied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {data.revenueByPromoCode.map((row) => (
                      <tr key={row.code}>
                        <td className="px-4 py-3 font-medium text-neutral-900">{row.code}</td>
                        <td className="px-4 py-3 text-right text-neutral-600">{row.orders}</td>
                        <td className="px-4 py-3 text-right text-neutral-900">${row.discount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="revenue-over-time" className="mt-4">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Revenue Over Time</h2>
            <p className="mt-1 text-sm text-neutral-500">Daily paid-order revenue across the last 90 days.</p>
            {data.revenueByDay.length === 0 ? (
              <p className="mt-6 text-sm text-neutral-500">No daily revenue data yet.</p>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Orders</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {data.revenueByDay.slice(-30).map((row) => {
                      const width = `${Math.max(8, (row.revenue / Math.max(...data.revenueByDay.map((entry) => entry.revenue), 1)) * 100)}%`;
                      return (
                        <tr key={row.date}>
                          <td className="px-4 py-3 text-neutral-700">{row.date}</td>
                          <td className="px-4 py-3 text-right text-neutral-600">{row.orders}</td>
                          <td className="px-4 py-3 text-right text-neutral-900">${row.revenue.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <div className="h-3 w-full rounded-full bg-neutral-100">
                              <div className="h-full rounded-full bg-[var(--theme-accent)]" style={{ width }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="addons" className="mt-4">
          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-neutral-900">Revenue by Add-on</h2>
                <Link href={`/api/organizer/analytics/export?months=${months}&type=addons`} className="text-sm font-medium text-[var(--theme-accent)] hover:underline">
                  Export CSV
                </Link>
              </div>
              {data.revenueByAddOn.length === 0 ? (
                <p className="px-6 py-8 text-sm text-neutral-500">No add-on sales yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                      <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                        <th className="px-4 py-3">Add-on</th>
                        <th className="px-4 py-3 text-right">Qty Sold</th>
                        <th className="px-4 py-3 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.revenueByAddOn.map((row) => (
                        <tr key={row.addOnName}>
                          <td className="px-4 py-3 font-medium text-neutral-900">{row.addOnName}</td>
                          <td className="px-4 py-3 text-right text-neutral-600">{row.quantity}</td>
                          <td className="px-4 py-3 text-right text-neutral-900">${row.revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-neutral-900">Affiliate Performance</h2>
              </div>
              {data.affiliateStats.length === 0 ? (
                <p className="px-6 py-8 text-sm text-neutral-500">No affiliate-linked orders yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50">
                      <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Label</th>
                        <th className="px-4 py-3 text-right">Orders</th>
                        <th className="px-4 py-3 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.affiliateStats.map((row) => (
                        <tr key={row.code}>
                          <td className="px-4 py-3 font-medium text-neutral-900">{row.code}</td>
                          <td className="px-4 py-3 text-neutral-600">{row.label}</td>
                          <td className="px-4 py-3 text-right text-neutral-600">{row.orders}</td>
                          <td className="px-4 py-3 text-right text-neutral-900">${row.revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        </TabsContent>
      </Tabs>
    </SidebarLayout>
  );
}
