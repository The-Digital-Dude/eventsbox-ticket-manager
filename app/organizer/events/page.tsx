"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Plus, Ticket, Users } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState } from "@/src/components/shared/empty-state";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";

type EventRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  startAt: string;
  endAt: string;
  rejectionReason: string | null;
  category: { name: string } | null;
  venue: { name: string } | null;
  _count: { ticketTypes: number; orders: number };
};

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

function statusBadgeClass(status: string) {
  if (status === "PUBLISHED") return "bg-emerald-100 text-emerald-700 border-transparent";
  if (status === "PENDING_APPROVAL") return "bg-amber-100 text-amber-700 border-transparent";
  if (status === "REJECTED") return "bg-red-100 text-red-700 border-transparent";
  if (status === "CANCELLED") return "bg-orange-100 text-orange-700 border-transparent";
  return "bg-neutral-100 text-neutral-600 border-transparent";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function OrganizerEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  async function load(status = statusFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/organizer/events?${params}`);
      const payload = await res.json();
      setEvents(payload?.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    load(statusFilter).then(() => { if (!active) return; });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function deleteEvent(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/organizer/events/${id}`, { method: "DELETE" });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to delete event");
    toast.success("Event deleted");
    await load();
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader
        title="My Events"
        subtitle="Create and manage your events. Submit for admin approval when ready."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          className="app-select w-[200px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="PUBLISHED">Published</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <Link href="/organizer/events/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          title="No events yet"
          subtitle="Create your first event to start selling tickets."
        />
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <article
              key={event.id}
              className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={statusBadgeClass(event.status)}>{event.status.replace("_", " ")}</Badge>
                    {event.category && <Badge>{event.category.name}</Badge>}
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-neutral-900">{event.title}</h3>
                  {event.venue && <p className="text-sm text-neutral-500">{event.venue.name}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/organizer/events/${event.id}`}>
                    <Button size="sm" variant="outline">Manage</Button>
                  </Link>
                  {event.status === "DRAFT" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => deleteEvent(event.id, event.title)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" />
                  {formatDate(event.startAt)} — {formatDate(event.endAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Ticket className="h-4 w-4 text-[var(--theme-accent)]" />
                  {event._count.ticketTypes} ticket type{event._count.ticketTypes !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[var(--theme-accent)]" />
                  {event._count.orders} order{event._count.orders !== 1 ? "s" : ""}
                </span>
              </div>

              {event.status === "REJECTED" && event.rejectionReason && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <strong>Rejection reason:</strong> {event.rejectionReason}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </SidebarLayout>
  );
}
