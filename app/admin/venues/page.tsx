"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState } from "@/src/components/shared/empty-state";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";

type VenueRow = {
  id: string;
  name: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  updatedAt: string;
  addressLine1: string;
  category?: { name: string } | null;
  state: { name: string };
  city: { name: string };
  organizerProfile: { user: { email: string } };
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

function venueStatusBadgeClass(status: VenueRow["status"]) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700 border-transparent";
  if (status === "REJECTED") return "bg-red-100 text-red-700 border-transparent";
  return "bg-amber-100 text-amber-700 border-transparent";
}

function formatShortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminVenuesPage() {
  const [rows, setRows] = useState<VenueRow[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [rejectDraft, setRejectDraft] = useState<{ id: string | null; reason: string }>({ id: null, reason: "" });

  async function load(
    nextStatus: string = status,
    nextQ: string = q,
    onRows: (nextRows: VenueRow[]) => void = setRows,
  ) {
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    const trimmedQ = nextQ.trim();
    if (trimmedQ) params.set("q", trimmedQ);

    const res = await fetch(`/api/admin/venues?${params.toString()}`);
    const payload = await res.json();
    const nextRows = (payload?.data ?? []) as VenueRow[];
    onRows(nextRows);
    return nextRows;
  }

  useEffect(() => {
    let active = true;

    load(status, q, (nextRows) => {
      if (active) setRows(nextRows);
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q]);

  async function decide(id: string, action: "APPROVED" | "REJECTED", reason?: string) {
    const res = await fetch(`/api/admin/venues/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Action failed");
    toast.success(`Venue ${action.toLowerCase()}`);
    setRejectDraft({ id: null, reason: "" });
    await load();
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Venue Requests" subtitle="Review venue requests." />

      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <select className="app-select" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All</option>
          <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search venue or organizer email..."
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No venues match the current filter." subtitle="Try changing status or search terms to find venue requests." />
      ) : (
        <div className="grid gap-3">
          {rows.map((venue) => (
            <article key={venue.id} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-neutral-900">{venue.name}</h3>
                  <p className="text-sm text-neutral-500">{venue.organizerProfile.user.email}</p>
                </div>
                <Badge className={venueStatusBadgeClass(venue.status)}>{venue.status}</Badge>
              </div>

              <div className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
                <MapPin className="h-4 w-4 text-[var(--theme-accent)]" />
                <span>{venue.addressLine1}, {venue.city.name}, {venue.state.name}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {venue.category?.name ? <Badge>{venue.category.name}</Badge> : <Badge>Uncategorized</Badge>}
                <Badge>Submitted: {formatShortDate(venue.updatedAt)}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => decide(venue.id, "APPROVED")}>Approve</Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => setRejectDraft({ id: venue.id, reason: venue.rejectionReason ?? "" })}
                >
                  Reject
                </Button>
              </div>

              {rejectDraft.id === venue.id ? (
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
                  <Input
                    value={rejectDraft.reason}
                    onChange={(event) => setRejectDraft({ id: venue.id, reason: event.target.value })}
                    placeholder="Add rejection reason"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => decide(venue.id, "REJECTED", rejectDraft.reason.trim() || undefined)}
                    >
                      Confirm Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejectDraft({ id: null, reason: "" })}>Cancel</Button>
                  </div>
                </div>
              ) : null}

              {venue.status === "REJECTED" && venue.rejectionReason ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Rejection reason: {venue.rejectionReason}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </SidebarLayout>
  );
}
