import Link from "next/link";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { prisma } from "@/src/lib/db";

const PAGE_SIZE = 20;

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

function parsePage(raw?: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function formatDateTime(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: Date) {
  return value.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default async function OrganizerEventAttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.user.role !== Role.ORGANIZER) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = sp.q?.trim() ?? "";

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    redirect("/organizer/status");
  }

  const event = await prisma.event.findFirst({
    where: { id, organizerProfileId: profile.id },
    select: { id: true, title: true, startAt: true },
  });
  if (!event) {
    redirect("/organizer/events");
  }

  const where = {
    eventId: event.id,
    status: "PAID" as const,
    ...(q ? { buyerEmail: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        buyerName: true,
        buyerEmail: true,
        total: true,
        paidAt: true,
        items: {
          select: {
            quantity: true,
            ticketType: { select: { name: true } },
            tickets: { select: { checkedInAt: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  const attendees = orders.map((order) => {
    const totalTickets = order.items.reduce((sum, item) => sum + item.tickets.length, 0);
    const checkedInTickets = order.items.reduce(
      (sum, item) => sum + item.tickets.filter((ticket) => Boolean(ticket.checkedInAt)).length,
      0,
    );

    return {
      id: order.id,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      tickets: order.items.map((item) => `${item.ticketType.name} x${item.quantity}`).join(", "),
      total: Number(order.total),
      paidAt: order.paidAt,
      checkinPercent: totalTickets > 0 ? Math.round((checkedInTickets / totalTickets) * 100) : 0,
      checkinSummary: `${checkedInTickets}/${totalTickets}`,
    };
  });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseQuery = {
    ...(q ? { q } : {}),
  };

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Attendee Roster</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{event.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">Starts {formatDate(event.startAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/organizer/events/${event.id}/attendees/export`}
            className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Export CSV
          </a>
          <Link
            href={`/organizer/events/${event.id}`}
            className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Back to Event
          </Link>
        </div>
      </div>

      <form method="GET" className="grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_120px]">
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
          Search
        </button>
      </form>

      <div className="text-sm text-neutral-500">
        {total} attendee order{total !== 1 ? "s" : ""} · page {page} / {pages}
      </div>

      {attendees.length === 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-neutral-500">No attendees match the current search.</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Tickets</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Paid At</th>
                  <th className="px-4 py-3">Check-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {attendees.map((attendee) => (
                  <tr key={attendee.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">{attendee.buyerName}</td>
                    <td className="px-4 py-3 text-neutral-700">{attendee.buyerEmail}</td>
                    <td className="px-4 py-3 text-neutral-700">{attendee.tickets}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">${attendee.total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-neutral-700">{formatDateTime(attendee.paidAt)}</td>
                    <td className="px-4 py-3 text-neutral-700">{attendee.checkinPercent}% ({attendee.checkinSummary})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
