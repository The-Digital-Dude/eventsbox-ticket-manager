"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, CalendarDays, CheckCircle2, Users, Ticket, DollarSign, Star } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import Link from "next/link";

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

type TicketType = {
  id: string; name: string; kind: string;
  price: number | string; quantity: number; sold: number; isActive: boolean;
};

type QRTicket = { id: string; ticketNumber: string; checkedInAt: string | null };
type OrderItem = {
  id: string; quantity: number;
  ticketType: { name: string };
  tickets: QRTicket[];
};
type Order = {
  id: string; buyerName: string; buyerEmail: string;
  total: number | string; paidAt: string | null;
  items: OrderItem[];
};

type EventDetail = {
  id: string; title: string; slug: string; status: string;
  adminNote: string | null; rejectionReason: string | null;
  isFeatured: boolean;
  startAt: string; endAt: string; timezone: string;
  category: { name: string } | null;
  venue: { name: string; addressLine1: string } | null;
  state: { name: string } | null;
  city: { name: string } | null;
  organizerProfile: { companyName: string | null; brandName: string | null; user: { email: string } };
  ticketTypes: TicketType[];
  orders: Order[];
};

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

export default function AdminEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [togglingFeatured, setTogglingFeatured] = useState(false);
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [requestChangesNote, setRequestChangesNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showRequestChangesForm, setShowRequestChangesForm] = useState(false);

  async function decide(action: "PUBLISHED" | "REJECTED" | "REQUEST_CHANGES") {
    setDeciding(true);
    const res = await fetch(`/api/admin/events/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "REJECTED"
          ? { action, reason: rejectReason.trim() || undefined }
          : action === "REQUEST_CHANGES"
            ? { action, adminNote: requestChangesNote.trim() || undefined }
            : { action },
      ),
    });
    const payload = await res.json();
    setDeciding(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Action failed");
    toast.success(action === "PUBLISHED" ? "Event published" : action === "REQUEST_CHANGES" ? "Changes requested" : "Event rejected");
    setShowRejectForm(false);
    setShowRequestChangesForm(false);
    setRejectReason("");
    setRequestChangesNote("");
    // Reload event
    const updated = await fetch(`/api/admin/events/${id}`).then((r) => r.json());
    if (updated?.data) setEvent(updated.data);
  }

  async function cancelEvent() {
    if (!confirm("Cancel this published event?")) return;

    setCanceling(true);
    const res = await fetch(`/api/admin/events/${id}/cancel`, { method: "POST" });
    const payload = await res.json();
    setCanceling(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to cancel event");
    toast.success("Event cancelled");
    const updated = await fetch(`/api/admin/events/${id}`).then((r) => r.json());
    if (updated?.data) setEvent(updated.data);
  }

  async function refundOrder(orderId: string) {
    if (!confirm("Refund this paid order?")) return;

    setRefundingOrderId(orderId);
    const res = await fetch(`/api/admin/events/${id}/orders/${orderId}/refund`, { method: "POST" });
    const payload = await res.json();
    setRefundingOrderId(null);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to refund order");
    toast.success("Order refunded");
    const updated = await fetch(`/api/admin/events/${id}`).then((r) => r.json());
    if (updated?.data) setEvent(updated.data);
  }

  async function toggleFeatured() {
    if (!event) return;

    const nextValue = !event.isFeatured;
    setTogglingFeatured(true);
    const res = await fetch(`/api/admin/events/${id}/feature`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFeatured: nextValue }),
    });
    const payload = await res.json();
    setTogglingFeatured(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to update featured state");

    setEvent((prev) => (prev ? { ...prev, isFeatured: Boolean(payload?.data?.isFeatured) } : prev));
    toast.success(nextValue ? "Event featured on homepage" : "Event removed from homepage");
  }

  useEffect(() => {
    fetch(`/api/admin/events/${id}`)
      .then((r) => r.json())
      .then((p) => {
        if (!p?.data) { toast.error("Event not found"); router.push("/admin/events"); return; }
        setEvent(p.data);
        setLoading(false);
      });
  }, [id, router]);

  if (loading || !event) {
    return (
      <SidebarLayout role="admin" title="Admin" items={nav}>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-neutral-100" />)}
        </div>
      </SidebarLayout>
    );
  }

  const allTickets = event.orders.flatMap((o) => o.items.flatMap((i) => i.tickets));
  const totalIssued = allTickets.length;
  const totalCheckedIn = allTickets.filter((t) => t.checkedInAt).length;
  const totalRevenue = event.orders.reduce((sum, o) => sum + Number(o.total), 0);
  const totalSold = event.ticketTypes.reduce((sum, t) => sum + t.sold, 0);

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <Link href="/admin/events" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
        <ChevronLeft className="h-4 w-4" /> Back to Events
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge className={statusBadgeClass(event.status)}>{event.status.replace("_", " ")}</Badge>
            {event.category && <Badge>{event.category.name}</Badge>}
            {event.isFeatured && (
              <Badge className="bg-blue-100 text-blue-700 border-transparent">Featured</Badge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{event.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {event.organizerProfile.brandName ?? event.organizerProfile.companyName ?? event.organizerProfile.user.email}
            {" · "}{event.organizerProfile.user.email}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={event.isFeatured ? "default" : "outline"}
            onClick={toggleFeatured}
            disabled={togglingFeatured}
            className={event.isFeatured ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Star className="mr-1 h-4 w-4" />
            {togglingFeatured ? "Saving..." : event.isFeatured ? "Unfeature" : "Feature on Homepage"}
          </Button>
          {event.status === "PENDING_APPROVAL" && (
            <>
            <Button size="sm" onClick={() => decide("PUBLISHED")} disabled={deciding}>
              {deciding ? "Processing..." : "Publish"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRequestChangesNote(event.adminNote ?? "");
                setShowRequestChangesForm((v) => !v);
              }}
            >
              Request Changes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={() => setShowRejectForm((v) => !v)}
            >
              Reject
            </Button>
            </>
          )}
          {event.status === "PUBLISHED" && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={cancelEvent}
              disabled={canceling}
            >
              {canceling ? "Cancelling..." : "Cancel Event"}
            </Button>
          )}
        </div>
      </div>

      {showRejectForm && (
        <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
          <Input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (optional)"
          />
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={() => decide("REJECTED")}
              disabled={deciding}
            >
              Confirm Reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowRejectForm(false); setRejectReason(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {showRequestChangesForm && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Input
            value={requestChangesNote}
            onChange={(e) => setRequestChangesNote(e.target.value)}
            placeholder="Requested changes for the organizer"
          />
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => decide("REQUEST_CHANGES")}
              disabled={deciding}
            >
              Send Request
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowRequestChangesForm(false); setRequestChangesNote(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {event.adminNote && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Requested changes: {event.adminNote}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm text-neutral-500">
            <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" /> Schedule
          </div>
          <p className="text-sm font-semibold text-neutral-900">{formatDateTime(event.startAt)}</p>
          <p className="text-xs text-neutral-500">to {formatDateTime(event.endAt)}</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm text-neutral-500">
            <Ticket className="h-4 w-4 text-[var(--theme-accent)]" /> Tickets Sold
          </div>
          <p className="text-3xl font-semibold text-neutral-900">{totalSold}</p>
          <p className="text-xs text-neutral-500">across {event.ticketTypes.length} type{event.ticketTypes.length !== 1 ? "s" : ""}</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm text-neutral-500">
            <CheckCircle2 className="h-4 w-4 text-[var(--theme-accent)]" /> Check-in Rate
          </div>
          <p className="text-3xl font-semibold text-neutral-900">
            {totalIssued > 0 ? `${Math.round((totalCheckedIn / totalIssued) * 100)}%` : "—"}
          </p>
          <p className="text-xs text-neutral-500">{totalCheckedIn} / {totalIssued} tickets</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm text-neutral-500">
            <DollarSign className="h-4 w-4 text-[var(--theme-accent)]" /> Gross Revenue
          </div>
          <p className="text-3xl font-semibold text-neutral-900">${totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-neutral-500">{event.orders.length} paid orders</p>
        </article>
      </div>

      {/* Ticket Types */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Ticket Types</h2>
        {event.ticketTypes.length === 0 ? (
          <p className="text-sm text-neutral-500">No ticket types.</p>
        ) : (
          <div className="space-y-3">
            {event.ticketTypes.map((tt) => {
              const soldPct = tt.quantity > 0 ? Math.round((tt.sold / tt.quantity) * 100) : 0;
              return (
                <div key={tt.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900">{tt.name}</span>
                      <Badge>{tt.kind}</Badge>
                      {!tt.isActive && <Badge className="bg-neutral-100 text-neutral-500 border-transparent">Inactive</Badge>}
                    </div>
                    <span className="font-semibold text-neutral-900">${Number(tt.price).toFixed(2)}</span>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-neutral-500">
                      <span>{tt.sold} sold / {tt.quantity} total</span>
                      <span>{soldPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-[var(--theme-accent)]" style={{ width: `${soldPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Orders */}
      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-neutral-900">Paid Orders</h2>
          <span className="text-sm text-neutral-500">{event.orders.length} total</span>
        </div>
        {event.status === "CANCELLED" && event.orders.length > 0 && (
          <div className="border-b border-[var(--border)] bg-orange-50 px-5 py-2 text-xs text-orange-700">
            Event is cancelled. Refund actions are enabled for paid orders.
          </div>
        )}
        {event.orders.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">No paid orders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Buyer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Tickets</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Paid At</th>
                  {event.status === "CANCELLED" && (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {event.orders.map((order) => {
                  const orderTickets = order.items.flatMap((i) => i.tickets);
                  const checkedIn = orderTickets.filter((t) => t.checkedInAt).length;
                  return (
                    <tr key={order.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900">{order.buyerName}</p>
                        <p className="text-xs text-neutral-500">{order.buyerEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {order.items.map((item) => `${item.ticketType.name} ×${item.quantity}`).join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={checkedIn === orderTickets.length && orderTickets.length > 0
                          ? "bg-emerald-100 text-emerald-700 border-transparent"
                          : checkedIn > 0
                            ? "bg-amber-100 text-amber-700 border-transparent"
                            : "bg-neutral-100 text-neutral-600 border-transparent"
                        }>
                          {checkedIn}/{orderTickets.length} in
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-neutral-900">${Number(order.total).toFixed(2)}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{order.paidAt ? formatDateTime(order.paidAt) : "—"}</td>
                      {event.status === "CANCELLED" && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => refundOrder(order.id)}
                            disabled={refundingOrderId === order.id}
                          >
                            {refundingOrderId === order.id ? "Refunding..." : "Refund"}
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </SidebarLayout>
  );
}
