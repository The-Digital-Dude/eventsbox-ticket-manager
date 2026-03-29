import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Badge } from "@/src/components/ui/badge";

const PAGE_SIZE = 20;

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

function parsePage(raw?: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function statusBadgeClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700 border-transparent";
  if (status === "PENDING") return "bg-amber-100 text-amber-700 border-transparent";
  if (status === "REFUNDED") return "bg-orange-100 text-orange-700 border-transparent";
  if (status === "FAILED") return "bg-red-100 text-red-700 border-transparent";
  return "bg-neutral-100 text-neutral-600 border-transparent";
}

function toDateLabel(value: Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = sp.q?.trim() || "";
  const rawStatus = sp.status?.trim() || "";
  const statusFilter = rawStatus && Object.values(OrderStatus).includes(rawStatus as OrderStatus) ? rawStatus : "";

  const where = {
    ...(statusFilter ? { status: statusFilter as OrderStatus } : {}),
    ...(q ? { buyerEmail: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        buyerEmail: true,
        buyerName: true,
        total: true,
        status: true,
        paidAt: true,
        createdAt: true,
        event: { select: { id: true, title: true, slug: true } },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const baseQuery = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q ? { q } : {}),
  };

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader
        title="Orders"
        subtitle="Search platform orders by buyer email and filter by payment status."
      />

      <form method="GET" className="grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm md:grid-cols-[220px_minmax(0,1fr)_140px]">
        <select name="status" defaultValue={statusFilter} className="app-select">
          <option value="">All statuses</option>
          {Object.values(OrderStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search buyer email..."
          className="h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--theme-accent-rgb)/0.3)]"
        />
        <button
          type="submit"
          className="h-10 rounded-xl bg-[var(--theme-accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Apply
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">Order List</h2>
          <p className="text-sm text-neutral-500">
            {total} result{total !== 1 ? "s" : ""} · page {page} / {pages}
          </p>
        </div>
        {orders.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-500">No orders match the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Buyer Email</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">{order.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{order.buyerEmail}</p>
                      <p className="text-xs text-neutral-500">{order.buyerName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/events/${order.event.slug}`} className="font-medium text-neutral-900 hover:text-[var(--theme-accent)]">
                        {order.event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900">${Number(order.total).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge className={statusBadgeClass(order.status)}>{order.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{toDateLabel(order.paidAt ?? order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={{ query: { ...baseQuery, page: page - 1 } }}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Previous
            </Link>
          )}
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
            .map((p) => (
              <Link
                key={p}
                href={{ query: { ...baseQuery, page: p } }}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  p === page
                    ? "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white"
                    : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {p}
              </Link>
            ))}
          {page < pages && (
            <Link
              href={{ query: { ...baseQuery, page: page + 1 } }}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </SidebarLayout>
  );
}
