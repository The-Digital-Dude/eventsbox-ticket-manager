import Link from "next/link";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { AttendeesTableClient } from "@/app/admin/attendees/attendees-table-client";

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

export default async function AdminAttendeesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.user.role !== Role.SUPER_ADMIN) {
    redirect("/auth/login");
  }

  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = sp.q?.trim() || "";
  const status = sp.status === "active" || sp.status === "suspended" ? sp.status : "";

  const where = {
    role: Role.ATTENDEE,
    ...(q ? { email: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "suspended" ? { isActive: false } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        createdAt: true,
        emailVerified: true,
        isActive: true,
        attendeeProfile: {
          select: {
            displayName: true,
            _count: { select: { orders: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  const attendees = users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.attendeeProfile?.displayName ?? null,
    orderCount: user.attendeeProfile?._count.orders ?? 0,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  }));

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseQuery = {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
  };

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader
        title="Attendees"
        subtitle="Search attendee accounts, review activity, and suspend or unsuspend access."
      />

      <form method="GET" className="grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm md:grid-cols-[220px_minmax(0,1fr)_140px]">
        <select name="status" defaultValue={status} className="app-select">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search attendee email..."
          className="h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--theme-accent-rgb)/0.3)]"
        />
        <button
          type="submit"
          className="h-10 rounded-xl bg-[var(--theme-accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Apply
        </button>
      </form>

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <p>
          {total} result{total !== 1 ? "s" : ""} · page {page} / {pages}
        </p>
      </div>

      <AttendeesTableClient initialAttendees={attendees} />

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
