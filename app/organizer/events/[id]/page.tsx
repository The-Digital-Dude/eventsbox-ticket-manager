"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, DollarSign, Package, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import Link from "next/link";

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  price: number | string;
  quantity: number;
  sold: number;
  maxPerOrder: number;
  isActive: boolean;
  sortOrder: number;
};

type EventDetail = {
  id: string;
  title: string;
  slug: string;
  status: string;
  heroImage: string | null;
  description: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  cancelPolicy: string | null;
  refundPolicy: string | null;
  commissionPct: number | string;
  gstPct: number | string;
  platformFeeFixed: number | string;
  rejectionReason: string | null;
  category: { id: string; name: string } | null;
  venue: { id: string; name: string; addressLine1: string } | null;
  ticketTypes: TicketType[];
  _count: { orders: number };
  orders: Array<{ total: number | string; platformFee: number | string; gst: number | string }>;
  auditLogs: Array<{
    id: string;
    action: string;
    createdAt: string;
    actor: { role: string; email: string };
  }>;
};

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatAuditAction(action: string) {
  return action.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);

  // Ticket form state
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [tName, setTName] = useState("");
  const [tDescription, setTDescription] = useState("");
  const [tKind, setTKind] = useState("DIRECT");
  const [tPrice, setTPrice] = useState("");
  const [tQuantity, setTQuantity] = useState("");
  const [tMaxPerOrder, setTMaxPerOrder] = useState("10");

  async function load() {
    const res = await fetch(`/api/organizer/events/${id}`);
    const payload = await res.json();
    if (!res.ok) { toast.error("Event not found"); router.push("/organizer/events"); return; }
    setEvent(payload.data);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  async function submitForApproval() {
    setSubmitting(true);
    const res = await fetch(`/api/organizer/events/${id}/submit`, { method: "POST" });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to submit");
    toast.success("Event submitted for admin approval");
    await load();
  }

  async function addTicket() {
    if (!tName.trim()) return toast.error("Ticket name is required");
    if (!tPrice) return toast.error("Price is required");
    if (!tQuantity) return toast.error("Quantity is required");
    setTicketSaving(true);
    const res = await fetch(`/api/organizer/events/${id}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tName, description: tDescription || undefined,
        kind: tKind, price: Number(tPrice), quantity: Number(tQuantity),
        maxPerOrder: Number(tMaxPerOrder),
      }),
    });
    const payload = await res.json();
    setTicketSaving(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to add ticket");
    toast.success("Ticket type added");
    setTName(""); setTDescription(""); setTPrice(""); setTQuantity(""); setTMaxPerOrder("10"); setTKind("DIRECT");
    setShowTicketForm(false);
    await load();
  }

  async function toggleTicket(ticketId: string, isActive: boolean) {
    const res = await fetch(`/api/organizer/events/${id}/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (!res.ok) return toast.error("Failed to update ticket");
    toast.success(isActive ? "Ticket deactivated" : "Ticket activated");
    await load();
  }

  async function deleteTicket(ticketId: string, name: string) {
    if (!confirm(`Delete ticket type "${name}"?`)) return;
    const res = await fetch(`/api/organizer/events/${id}/tickets/${ticketId}`, { method: "DELETE" });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to delete ticket");
    toast.success("Ticket type deleted");
    await load();
  }

  async function cancelEvent() {
    if (!event) return;

    const paidOrdersCount = event.orders.length;
    const message = paidOrdersCount > 0
      ? `This event has ${paidOrdersCount} paid order(s). Cancel event anyway?`
      : "Cancel this published event?";
    if (!confirm(message)) return;

    setCanceling(true);
    const res = await fetch(`/api/organizer/events/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acknowledgePaidOrders: paidOrdersCount > 0,
      }),
    });
    const payload = await res.json();
    setCanceling(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to cancel event");
    toast.success("Event cancelled");
    await load();
  }

  async function duplicateEvent() {
    if (!confirm("Duplicate this event? A new DRAFT copy will be created with all ticket types.")) return;
    const res = await fetch(`/api/organizer/events/${id}/duplicate`, { method: "POST" });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to duplicate event");
    toast.success("Event duplicated! Redirecting to copy...");
    router.push(`/organizer/events/${payload.data.id}`);
  }

  const canEdit = event?.status === "DRAFT" || event?.status === "REJECTED";
  const canSubmit = canEdit && (event?.ticketTypes?.filter((t) => t.isActive).length ?? 0) > 0;

  if (loading) {
    return (
      <SidebarLayout role="organizer" title="Organizer" items={nav}>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-neutral-100" />)}
        </div>
      </SidebarLayout>
    );
  }

  if (!event) return null;

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      {/* Back + Header */}
      <div className="space-y-1">
        <Link href="/organizer/events" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
          <ChevronLeft className="h-4 w-4" /> Events
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge className={`mb-2 ${statusBadgeClass(event.status)}`}>{event.status.replace("_", " ")}</Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{event.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Link href={`/organizer/events/${id}/edit`}>
                <Button variant="outline" size="sm">Edit Event</Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={duplicateEvent}>
              Duplicate
            </Button>
            {event.status === "PUBLISHED" && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={cancelEvent}
                disabled={canceling}
              >
                {canceling ? "Cancelling..." : "Cancel Event"}
              </Button>
            )}
            {canSubmit && (
              <Button onClick={submitForApproval} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit for Approval"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {event.status === "REJECTED" && event.rejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Rejected:</strong> {event.rejectionReason}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-600">
            <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" /> Schedule
          </div>
          <p className="text-sm font-semibold text-neutral-900">{formatDateTime(event.startAt)}</p>
          <p className="text-xs text-neutral-500">to {formatDateTime(event.endAt)}</p>
          <p className="mt-1 text-xs text-neutral-400">{event.timezone}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-600">
            <Package className="h-4 w-4 text-[var(--theme-accent)]" /> Tickets
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{event.ticketTypes.length}</p>
          <p className="text-sm text-neutral-500">ticket type{event.ticketTypes.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-600">
            <Users className="h-4 w-4 text-[var(--theme-accent)]" /> Orders
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{event._count.orders}</p>
          <p className="text-sm text-neutral-500">paid order{event._count.orders !== 1 ? "s" : ""}</p>
          {event._count.orders > 0 && (
            <Link href={`/organizer/events/${id}/orders`} className="mt-2 inline-block text-xs text-[var(--theme-accent)] underline underline-offset-4">
              View orders →
            </Link>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-600">
            <DollarSign className="h-4 w-4 text-[var(--theme-accent)]" /> Revenue
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">
            ${event.orders.reduce((sum, o) => sum + Number(o.total), 0).toFixed(2)}
          </p>
          <p className="text-sm text-neutral-500">gross (incl. fees)</p>
        </div>
      </div>

      {/* Event status timeline */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Status Timeline</h2>
        {event.auditLogs.length === 0 ? (
          <p className="text-sm text-neutral-500">No timeline entries yet.</p>
        ) : (
          <ol className="space-y-3">
            {event.auditLogs.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--theme-accent)]" />
                <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                  <p className="text-sm font-medium text-neutral-900">{formatAuditAction(entry.action)}</p>
                  <p className="text-xs text-neutral-500">
                    {entry.actor.role.replaceAll("_", " ")} · {formatDateTime(entry.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Ticket Types */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Ticket Types</h2>
          {canEdit && (
            <Button size="sm" onClick={() => setShowTicketForm((v) => !v)}>
              {showTicketForm ? "Cancel" : "+ Add Ticket"}
            </Button>
          )}
        </div>

        {showTicketForm && (
          <div className="mb-6 rounded-xl border border-[rgb(var(--theme-accent-rgb)/0.2)] bg-[rgb(var(--theme-accent-rgb)/0.04)] p-5">
            <h3 className="mb-4 text-base font-semibold text-neutral-900">New Ticket Type</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Name <span className="text-red-500">*</span></Label>
                <Input value={tName} onChange={(e) => setTName(e.target.value)} placeholder="e.g. General Admission" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Input value={tDescription} onChange={(e) => setTDescription(e.target.value)} placeholder="Optional description" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <select className="app-select" value={tKind} onChange={(e) => setTKind(e.target.value)}>
                  <option value="DIRECT">Direct</option>
                  <option value="COMBO">Combo</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Price ($) <span className="text-red-500">*</span></Label>
                <Input type="number" min="0" step="0.01" value={tPrice} onChange={(e) => setTPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Quantity <span className="text-red-500">*</span></Label>
                <Input type="number" min="1" value={tQuantity} onChange={(e) => setTQuantity(e.target.value)} placeholder="100" />
              </div>
              <div className="space-y-2">
                <Label>Max per order</Label>
                <Input type="number" min="1" max="100" value={tMaxPerOrder} onChange={(e) => setTMaxPerOrder(e.target.value)} />
              </div>
            </div>
            <Button className="mt-4" onClick={addTicket} disabled={ticketSaving}>
              {ticketSaving ? "Adding..." : "Add Ticket Type"}
            </Button>
          </div>
        )}

        {event.ticketTypes.length === 0 ? (
          <p className="text-sm text-neutral-500">No ticket types yet. Add one above to get started.</p>
        ) : (
          <div className="space-y-3">
            {event.ticketTypes.map((ticket) => {
              const available = ticket.quantity - ticket.sold;
              const soldPct = Math.round((ticket.sold / ticket.quantity) * 100);
              return (
                <div key={ticket.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">{ticket.name}</span>
                        <Badge>{ticket.kind}</Badge>
                        {!ticket.isActive && <Badge className="bg-neutral-100 text-neutral-500">Inactive</Badge>}
                      </div>
                      {ticket.description && <p className="mt-1 text-sm text-neutral-500">{ticket.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-[var(--theme-accent)]" />
                      <span className="text-lg font-semibold text-neutral-900">${Number(ticket.price).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-neutral-500">
                      <span>{ticket.sold} sold / {ticket.quantity} total</span>
                      <span>{available} available</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-[var(--theme-accent)]"
                        style={{ width: `${Math.min(100, soldPct)}%` }}
                      />
                    </div>
                  </div>

                  {canEdit && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleTicket(ticket.id, ticket.isActive)}>
                        {ticket.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      {ticket.sold === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => deleteTicket(ticket.id, ticket.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Event Info */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Event Details</h2>
        {event.heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.heroImage} alt={event.title} className="mb-4 h-48 w-full rounded-xl object-cover" />
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: "Category", value: event.category?.name ?? "—" },
            { label: "Venue", value: event.venue?.name ?? "—" },
            { label: "Contact Email", value: event.contactEmail ?? "—" },
            { label: "Contact Phone", value: event.contactPhone ?? "—" },
            { label: "Commission", value: `${event.commissionPct}%` },
            { label: "GST", value: `${event.gstPct}%` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-sm text-neutral-500">{label}</p>
              <p className="text-sm font-medium text-neutral-900">{value}</p>
            </div>
          ))}
          {event.description && (
            <div className="md:col-span-2">
              <p className="text-sm text-neutral-500">Description</p>
              <p className="text-sm text-neutral-900">{event.description}</p>
            </div>
          )}
          {event.cancelPolicy && (
            <div className="md:col-span-2">
              <p className="text-sm text-neutral-500">Cancellation Policy</p>
              <p className="text-sm text-neutral-900">{event.cancelPolicy}</p>
            </div>
          )}
          {event.refundPolicy && (
            <div className="md:col-span-2">
              <p className="text-sm text-neutral-500">Refund Policy</p>
              <p className="text-sm text-neutral-900">{event.refundPolicy}</p>
            </div>
          )}
        </div>

        {event.status === "PUBLISHED" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Your event is live at <strong>/events/{event.slug}</strong>
          </div>
        )}
      </section>
    </SidebarLayout>
  );
}
