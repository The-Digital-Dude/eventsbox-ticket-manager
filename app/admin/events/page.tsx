"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Ticket, Users } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState } from "@/src/components/shared/empty-state";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import Link from "next/link";

type EventRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  isFeatured: boolean;
  startAt: string;
  submittedAt: string | null;
  rejectionReason: string | null;
  adminNote: string | null;
  category: { name: string } | null;
  venue: { name: string } | null;
  organizerProfile: { companyName: string | null; user: { email: string } };
  _count: { ticketTypes: number; orders: number };
};

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

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("PENDING_APPROVAL");
  const [q, setQ] = useState("");
  const [rejectDraft, setRejectDraft] = useState<{ id: string | null; reason: string }>({ id: null, reason: "" });
  const [changesDraft, setChangesDraft] = useState<{ id: string | null; note: string }>({ id: null, note: "" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPendingAction, setBulkPendingAction] = useState<string | null>(null);

  async function load(nextStatus = status, nextQ = q) {
    setLoading(true);
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    if (nextQ.trim()) params.set("q", nextQ.trim());
    const res = await fetch(`/api/admin/events?${params}`);
    const payload = await res.json();
    setEvents(payload?.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    load(status, q).then(() => { if (!active) return; });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => events.some((event) => event.id === id)));
  }, [events]);

  async function decide(id: string, action: "PUBLISHED" | "REJECTED" | "REQUEST_CHANGES", reason?: string) {
    const res = await fetch(`/api/admin/events/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "REQUEST_CHANGES" ? { action, adminNote: reason } : { action, reason }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Action failed");
    toast.success(action === "PUBLISHED" ? "Event published" : action === "REQUEST_CHANGES" ? "Changes requested" : "Event rejected");
    setRejectDraft({ id: null, reason: "" });
    setChangesDraft({ id: null, note: "" });
    await load();
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id];
      }

      return prev.filter((item) => item !== id);
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? events.map((event) => event.id) : []);
  }

  async function runBulkAction(action: "APPROVE" | "REJECT" | "FEATURE" | "UNFEATURE") {
    if (selectedIds.length === 0) return;

    setBulkPendingAction(action);
    const res = await fetch("/api/admin/events/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action }),
    });
    const payload = await res.json();
    setBulkPendingAction(null);

    if (!res.ok) {
      return toast.error(payload?.error?.message ?? "Bulk action failed");
    }

    setSelectedIds([]);
    toast.success(`${payload?.data?.updated ?? selectedIds.length} event(s) updated`);
    await load();
  }

  const allVisibleSelected = events.length > 0 && selectedIds.length === events.length;
  const someVisibleSelected = selectedIds.length > 0 && selectedIds.length < events.length;

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Event Governance" subtitle="Review and publish or reject organizer event submissions." />

      <div className="grid gap-3 md:grid-cols-[200px_220px_minmax(0,1fr)]">
        <select className="app-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or organizer..." />
      </div>

      {!loading && events.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--border)] text-[var(--theme-accent)]"
              checked={allVisibleSelected}
              ref={(node) => {
                if (node) node.indeterminate = someVisibleSelected;
              }}
              onChange={(e) => toggleSelectAll(e.target.checked)}
            />
            Select all visible
          </label>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-neutral-500">
                {selectedIds.length} selected
              </span>
              <Button
                size="sm"
                onClick={() => void runBulkAction("APPROVE")}
                disabled={bulkPendingAction !== null}
              >
                {bulkPendingAction === "APPROVE" ? "Approving..." : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void runBulkAction("REJECT")}
                disabled={bulkPendingAction !== null}
              >
                {bulkPendingAction === "REJECT" ? "Rejecting..." : "Reject"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void runBulkAction("FEATURE")}
                disabled={bulkPendingAction !== null}
              >
                {bulkPendingAction === "FEATURE" ? "Featuring..." : "Feature"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void runBulkAction("UNFEATURE")}
                disabled={bulkPendingAction !== null}
              >
                {bulkPendingAction === "UNFEATURE" ? "Unfeaturing..." : "Unfeature"}
              </Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-neutral-100" />)}
        </div>
      ) : events.length === 0 ? (
        <EmptyState title="No events match the current filter." subtitle="Try a different status or search term." />
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <article
              key={event.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                selectedIds.includes(event.id)
                  ? "border-[rgb(var(--theme-accent-rgb)/0.45)]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <label className="mb-2 inline-flex items-center gap-2 text-sm text-neutral-500">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--border)] text-[var(--theme-accent)]"
                      checked={selectedIds.includes(event.id)}
                      onChange={(e) => toggleSelected(event.id, e.target.checked)}
                    />
                    Select event
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={statusBadgeClass(event.status)}>{event.status.replace("_", " ")}</Badge>
                    {event.category && <Badge>{event.category.name}</Badge>}
                    {event.isFeatured && (
                      <Badge className="border-transparent bg-sky-100 text-sky-700">Featured</Badge>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-neutral-900">
                    <Link href={`/admin/events/${event.id}`} className="hover:text-[var(--theme-accent)] transition">
                      {event.title}
                    </Link>
                    <Link href={`/admin/events/${event.id}`} className="ml-2 inline-flex">
                      <ExternalLink className="h-4 w-4 text-neutral-400 hover:text-[var(--theme-accent)]" />
                    </Link>
                  </h3>
                  <p className="text-sm text-neutral-500">
                    {event.organizerProfile.companyName ?? event.organizerProfile.user.email}
                    {" · "}
                    {event.organizerProfile.user.email}
                  </p>
                </div>
                {event.status === "PENDING_APPROVAL" && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => decide(event.id, "PUBLISHED")}>Publish</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setChangesDraft({ id: event.id, note: event.adminNote ?? "" })}
                    >
                      Request Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => setRejectDraft({ id: event.id, reason: "" })}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" />
                  {formatDate(event.startAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Ticket className="h-4 w-4 text-[var(--theme-accent)]" />
                  {event._count.ticketTypes} ticket type{event._count.ticketTypes !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[var(--theme-accent)]" />
                  {event._count.orders} order{event._count.orders !== 1 ? "s" : ""}
                </span>
                {event.submittedAt && (
                  <span className="text-neutral-400">Submitted {formatDate(event.submittedAt)}</span>
                )}
              </div>

              {event.venue && (
                <p className="mt-2 text-sm text-neutral-500">Venue: {event.venue.name}</p>
              )}

              {rejectDraft.id === event.id && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
                  <Input
                    value={rejectDraft.reason}
                    onChange={(e) => setRejectDraft({ id: event.id, reason: e.target.value })}
                    placeholder="Rejection reason (optional)"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => decide(event.id, "REJECTED", rejectDraft.reason.trim() || undefined)}
                    >
                      Confirm Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejectDraft({ id: null, reason: "" })}>Cancel</Button>
                  </div>
                </div>
              )}

              {changesDraft.id === event.id && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <Input
                    value={changesDraft.note}
                    onChange={(e) => setChangesDraft({ id: event.id, note: e.target.value })}
                    placeholder="Requested changes for the organizer"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decide(event.id, "REQUEST_CHANGES", changesDraft.note.trim() || undefined)}
                    >
                      Send Request
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setChangesDraft({ id: null, note: "" })}>Cancel</Button>
                  </div>
                </div>
              )}

              {event.status === "REJECTED" && event.rejectionReason && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  Rejection reason: {event.rejectionReason}
                </div>
              )}
              {event.adminNote && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Requested changes: {event.adminNote}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </SidebarLayout>
  );
}
