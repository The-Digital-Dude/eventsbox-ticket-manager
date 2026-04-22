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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import Link from "next/link";
import {
  deriveEventLayoutModeFromTicketClasses,
  formatTicketClassTypeLabel,
  type TicketClassType,
} from "@/src/lib/ticket-classes";
import { RelationalSeatingLayout } from "@/src/types/event-draft";

type VenueSection = {
  id: string;
  name: string;
  sectionType: string;
};

type TicketClassView = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  inventoryMode?: string | null;
  classType: TicketClassType;
  sectionId: string | null;
  eventSeatingSectionId: string | null;
  price: number | string;
  quantity: number;
  sold: number;
  reservedQty: number;
  compIssued: number;
  maxPerOrder: number;
  isActive: boolean;
  sortOrder: number;
};

type EventLocation =
  | {
      type: "PHYSICAL";
      venueName?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      postalCode?: string | null;
      locationNotes?: string | null;
    }
  | {
      type: "ONLINE";
      platform?: string | null;
      accessLink?: string | null;
      accessInstructions?: string | null;
    };

type EventDetail = {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  heroImage: string | null;
  description: string | null;
  eventLocationType: string;
  location: EventLocation | null;
  startAt: string;
  endAt: string;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  cancelPolicy: string | null;
  refundPolicy: string | null;
  customConfirmationMessage: string | null;
  commissionPct: number | string;
  gstPct: number | string;
  platformFeeFixed: number | string;
  rejectionReason: string | null;
  category: { id: string; name: string } | null;
  venue: {
    id: string;
    name: string;
    addressLine1: string;
  } | null;
  ticketTypes: TicketClassView[];
  ticketClasses?: TicketClassView[];
  _count: { orders: number; waitlist: number };
  orders: Array<{ total: number | string; platformFee: number | string; gst: number | string }>;
  auditLogs: Array<{
    id: string;
    action: string;
    createdAt: string;
    actor: { role: string; email: string };
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    isVisible: boolean;
    createdAt: string;
    attendeeName: string;
  }>;
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatAuditAction(action: string) {
  return action.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function getInlineVenueName(location: EventLocation | null) {
  if (location?.type !== "PHYSICAL") return null;
  return location.venueName?.trim() || null;
}

function getInlineLocationAddress(location: EventLocation | null) {
  if (location?.type !== "PHYSICAL") return null;
  return [
    location.address,
    [location.city, location.state, location.postalCode].filter(Boolean).join(", "),
    location.country,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n");
}

function getOnlineLocationLabel(location: EventLocation | null) {
  if (location?.type !== "ONLINE") return null;
  return location.platform?.trim() || location.accessLink?.trim() || "Online event";
}

function formatLayoutStatus(layoutMode: string, isComplete: boolean) {
  if (isComplete) {
    switch (layoutMode) {
      case "ROWS":
        return "Seating layout complete";
      case "TABLES":
        return "Table layout complete";
      case "MIXED":
        return "Mixed layout complete";
      default:
        return "No layout required";
    }
  }

  switch (layoutMode) {
    case "ROWS":
      return "Seating layout required";
    case "TABLES":
      return "Table layout required";
    case "MIXED":
      return "Mixed layout required";
    default:
      return "No layout required";
  }
}

type LayoutData = {
  event: {
    id: string;
    title: string;
    status: string;
    venue: EventDetail['venue'];
    seatingMode: string;
    ticketClasses: TicketClassView[];
  };
  layoutDecision: {
    layoutType: 'none' | 'seating' | 'table' | 'mixed';
    eventSeatingMode: 'GA_ONLY' | 'ROWS' | 'TABLES' | 'MIXED';
    requiresLayout: boolean;
    requiresVenue: boolean;
    supportsSeating: boolean;
    supportsTables: boolean;
  };
  seating: RelationalSeatingLayout | null;
  sections: Array<{
    id: string;
    key: string;
    name: string;
    sectionType: string;
    capacity: number | null;
    usedQuantity: number;
    remainingCapacity: number | null;
  }>;
};

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [layoutData, setLayoutData] = useState<LayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Ticket form state
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [tName, setTName] = useState("");
  const [tDescription, setTDescription] = useState("");
  const [tKind, setTKind] = useState("DIRECT");
  const [tClassType, setTClassType] = useState<TicketClassType>("general");
  const [tSectionId, setTSectionId] = useState("");
  const [tPrice, setTPrice] = useState("");
  const [tQuantity, setTQuantity] = useState("");
  const [tMaxPerOrder, setTMaxPerOrder] = useState("10");

  async function load() {
    const res = await fetch(`/api/organizer/events/${id}`);
    const payload = await res.json();
    if (!res.ok) { toast.error("Event not found"); router.push("/organizer/events"); return; }
    setEvent(payload.data);

    const derivedLayoutMode = deriveEventLayoutModeFromTicketClasses(
      (payload.data.ticketClasses ?? payload.data.ticketTypes ?? []).filter((ticketClass: TicketClassView) => ticketClass.isActive).map((ticketClass: TicketClassView) => ticketClass.classType),
    );

    if (derivedLayoutMode !== "GA_ONLY") {
      const layoutRes = await fetch(`/api/organizer/events/${id}/layout`);
      const layoutPayload = await layoutRes.json();
      if (layoutRes.ok) {
        setLayoutData(layoutPayload.data);
      } else {
        console.error("Failed to load layout data:", layoutPayload);
        setLayoutData(null);
      }
    } else {
      setLayoutData(null);
    }

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
    if (!tName.trim()) return toast.error("Ticket class name is required");
    if (!tPrice) return toast.error("Price is required");
    if (!tQuantity) return toast.error("Quantity is required");
    setTicketSaving(true);
    const res = await fetch(`/api/organizer/events/${id}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tName, description: tDescription || undefined,
        kind: tKind, classType: tClassType, sectionId: tSectionId || null,
        price: Number(tPrice), quantity: Number(tQuantity),
        maxPerOrder: Number(tMaxPerOrder),
      }),
    });
    const payload = await res.json();
    setTicketSaving(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to add ticket class");

    const nextLayoutMode = deriveEventLayoutModeFromTicketClasses([
      ...ticketClasses.filter((ticketClass) => ticketClass.isActive).map((ticketClass) => ticketClass.classType),
      tClassType,
    ]);

    toast.success("Ticket class added");
    setTName(""); setTDescription(""); setTPrice(""); setTQuantity(""); setTMaxPerOrder("10"); setTKind("DIRECT"); setTClassType("general"); setTSectionId("");
    setShowTicketForm(false);

    if (nextLayoutMode === "GA_ONLY") {
      await load();
      toast.message("General admission ticket classes do not require seating setup");
      return;
    }
    router.push(`/organizer/events/${id}/layout`);
  }

  async function toggleTicket(ticketId: string, isActive: boolean) {
    const res = await fetch(`/api/organizer/events/${id}/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (!res.ok) return toast.error("Failed to update ticket");
    toast.success(isActive ? "Ticket class deactivated" : "Ticket class activated");
    await load();
  }

  async function deleteTicket(ticketId: string, name: string) {
    if (!confirm(`Delete ticket class "${name}"?`)) return;
    const res = await fetch(`/api/organizer/events/${id}/tickets/${ticketId}`, { method: "DELETE" });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to delete ticket class");
    toast.success("Ticket class deleted");
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
    if (!confirm("Duplicate this event? A new DRAFT copy will be created with all ticket classes.")) return;
    const res = await fetch(`/api/organizer/events/${id}/duplicate`, { method: "POST" });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to duplicate event");
    toast.success("Event duplicated! Redirecting to copy...");
    router.push(`/organizer/events/${payload.data.id}`);
  }

  async function togglePublish() {
    setPublishing(true);
    const res = await fetch(`/api/organizer/events/${id}/publish`, { method: "POST" });
    const payload = await res.json();
    setPublishing(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to update event visibility");
    toast.success(payload.data.status === "PUBLISHED" ? "Event is live again" : "Event taken offline");
    await load();
  }

  const canEdit = event?.status === "DRAFT" || event?.status === "REJECTED";
  const ticketClasses = event?.ticketClasses ?? event?.ticketTypes ?? [];
  const activeTicketClasses = ticketClasses.filter((ticketClass) => ticketClass.isActive);

  const derivedLayoutMode =
    layoutData?.layoutDecision?.eventSeatingMode ??
    deriveEventLayoutModeFromTicketClasses(activeTicketClasses.map((ticketClass) => ticketClass.classType));
  const requiresLayout = layoutData?.layoutDecision?.requiresLayout ?? derivedLayoutMode !== "GA_ONLY";
  const layoutSections = layoutData?.sections ?? [];
  const layoutTicketClasses = layoutData?.event?.ticketClasses ?? activeTicketClasses;
  const layoutRequiredTicketClasses = layoutTicketClasses.filter((ticketClass) => ticketClass.isActive && ticketClass.classType !== "general");
  const hasSavedLayoutSections = layoutSections.length > 0;
  const hasMappedRequiredTicketClasses = layoutRequiredTicketClasses.every(
    (ticketClass) => Boolean(ticketClass.eventSeatingSectionId || ticketClass.sectionId),
  );
  const isLayoutSetupComplete = !requiresLayout || (hasSavedLayoutSections && hasMappedRequiredTicketClasses);

  const canSubmit =
    canEdit &&
    activeTicketClasses.length > 0 &&
    (!layoutData ||
      !requiresLayout ||
      isLayoutSetupComplete);

  function getLayoutStatusMessage() {
    if (derivedLayoutMode === "GA_ONLY") {
      return "All active ticket classes are general admission. You can continue reviewing the event without seating setup.";
    }

    if (isLayoutSetupComplete) {
      return event?.venue?.id
        ? "Layout is saved and ticket classes are mapped. You can edit the layout if seating or table setup changes."
        : "Event-owned layout is saved and ticket classes are mapped. You can attach a venue later if needed.";
    }

    if (!hasSavedLayoutSections) {
      return event?.venue?.id
        ? "Ticket classes require layout setup. Continue into the event layout builder to create seating or table sections."
        : "Ticket classes require layout setup. Continue into the event layout builder, then attach or create the venue as needed.";
    }

    return "Layout sections are saved, but one or more seating or table ticket classes still need a layout target.";
  }

  function continueSetup() {
    if (derivedLayoutMode === "GA_ONLY") {
      toast.message("This event does not need venue seating or table layout setup");
      return;
    }
    router.push(`/organizer/events/${id}/layout`);
  }

  function getTicketLayoutLabel(ticket: TicketClassView) {
    if (ticket.eventSeatingSectionId) {
      return layoutSections.find((section) => section.id === ticket.eventSeatingSectionId)?.name ?? "Mapped layout";
    }
    return ticket.classType === "general" ? "GA" : "Unmapped";
  }

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

  const inlineVenueName = getInlineVenueName(event.location);
  const inlineAddress = getInlineLocationAddress(event.location);
  const onlineLocationLabel = getOnlineLocationLabel(event.location);
  const venueDisplayName = event.venue?.name ?? inlineVenueName ?? onlineLocationLabel ?? "—";

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
            {event._count.waitlist > 0 && (
              <Badge className="mb-2 ml-2 border-transparent bg-amber-100 text-amber-700">
                Waitlist {event._count.waitlist}
              </Badge>
            )}
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{event.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/organizer/events/${id}/attendees/export`}>
              <Button variant="outline" size="sm">Export Attendees</Button>
            </a>
            <Link href={`/organizer/events/${id}/attendees`}>
              <Button variant="outline" size="sm">View Attendees</Button>
            </Link>
            <Link href={`/organizer/events/${id}/comp-tickets`}>
              <Button variant="outline" size="sm">Comp Tickets</Button>
            </Link>
            <Link href={`/organizer/events/${id}/addons`}>
              <Button variant="outline" size="sm">Add-ons</Button>
            </Link>
            {event._count.waitlist > 0 && (
              <Link href={`/organizer/events/${id}/waitlist`}>
                <Button variant="outline" size="sm">Waitlist ({event._count.waitlist})</Button>
              </Link>
            )}
            {canEdit && (
              <Link href={`/organizer/events/${id}/edit`}>
                <Button variant="outline" size="sm">Edit Event</Button>
              </Link>
            )}
            {event.publishedAt && (event.status === "PUBLISHED" || event.status === "DRAFT") && (
              <Button variant="outline" size="sm" onClick={togglePublish} disabled={publishing}>
                {publishing ? "Updating..." : event.status === "PUBLISHED" ? "Take Offline" : "Publish"}
              </Button>
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
            {/* Placeholder for event.createdViaSimpleMode */}
            <Button variant="outline" size="sm" onClick={() => router.push(`/organizer/events/new?fromEventId=${id}`)}>
              Switch to Advanced Setup
            </Button>
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

      {ticketClasses.length > 0 && (
        <div className="rounded-xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.05)] px-4 py-3 text-sm text-neutral-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-neutral-900">{formatLayoutStatus(derivedLayoutMode, isLayoutSetupComplete)}</p>
              <p className="mt-1">
                {getLayoutStatusMessage()}
              </p>
            </div>
            {derivedLayoutMode !== "GA_ONLY" && (
              <Button size="sm" onClick={continueSetup}>
                {isLayoutSetupComplete ? "Edit Layout" : "Continue Layout Setup"}
              </Button>
            )}
          </div>
        </div>
      )}

      {layoutData && (layoutData.layoutDecision?.requiresLayout || layoutData.seating) && (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Layout Configuration</h2>
          <h3 className="mb-4 text-base font-semibold text-neutral-900">Sections</h3>
          {layoutSections.length === 0 ? (
            <p className="text-sm text-neutral-500">No sections defined.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Capacity</th>
                    <th className="px-4 py-3">Used</th>
                    <th className="px-4 py-3">Remaining</th>
                    <th className="px-4 py-3">Mapped Ticket Classes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {layoutSections.map((section) => (
                    <tr key={section.id}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{section.name}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        <Badge>{section.sectionType}</Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{section.capacity ?? "Unbounded"}</td>
                      <td className="px-4 py-3 text-neutral-600">{section.usedQuantity}</td>
                      <td className="px-4 py-3 text-neutral-600">{section.remainingCapacity ?? "Unbounded"}</td>
                      <td className="px-4 py-3">
                        {layoutData.event.ticketClasses
                          .filter((ticket) => ticket.eventSeatingSectionId === section.id)
                          .map((ticket) => (
                            <Badge key={ticket.id} className="mr-1 mb-1 border-transparent bg-violet-100 text-violet-700">
                              {ticket.name}
                            </Badge>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
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
            <Package className="h-4 w-4 text-[var(--theme-accent)]" /> Ticket Classes
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{ticketClasses.length}</p>
          <p className="text-sm text-neutral-500">ticket class{ticketClasses.length !== 1 ? "es" : ""}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-600">
            <Users className="h-4 w-4 text-[var(--theme-accent)]" /> Orders
          </div>
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">{event._count.orders}</p>
          <p className="text-sm text-neutral-500">paid order{event._count.orders !== 1 ? "s" : ""}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {event._count.orders > 0 && (
              <Link href={`/organizer/events/${id}/orders`} className="inline-block text-xs text-[var(--theme-accent)] underline underline-offset-4">
                View orders →
              </Link>
            )}
            {event._count.waitlist > 0 && (
              <Link href={`/organizer/events/${id}/waitlist`} className="inline-block text-xs text-[var(--theme-accent)] underline underline-offset-4">
                View waitlist →
              </Link>
            )}
          </div>
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

      {/* Ticket Classes */}
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Ticket Classes</h2>
          {canEdit && (
            <Button size="sm" onClick={() => setShowTicketForm((v) => !v)}>
              {showTicketForm ? "Cancel" : "+ Add Ticket Class"}
            </Button>
          )}
        </div>

        {showTicketForm && (
          <div className="mb-6 rounded-xl border border-[rgb(var(--theme-accent-rgb)/0.2)] bg-[rgb(var(--theme-accent-rgb)/0.04)] p-5">
            <h3 className="mb-4 text-base font-semibold text-neutral-900">New Ticket Class</h3>
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
                <Label>Record Type</Label>
                <select className="app-select" value={tKind} onChange={(e) => setTKind(e.target.value)}>
                  <option value="DIRECT">Direct</option>
                  <option value="COMBO">Combo</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Class Type</Label>
                <select className="app-select" value={tClassType} onChange={(e) => setTClassType(e.target.value as TicketClassType)}>
                  <option value="general">General</option>
                  <option value="seating">Seating</option>
                  <option value="table">Table</option>
                  <option value="mixed">Mixed</option>
                </select>
                <p className="text-xs text-neutral-500">
                  Class type drives whether the event needs no layout, seating, table, or mixed setup.
                </p>
              </div>
              <div className="space-y-2">
                  <Label>Seating Section</Label>
                  <select className="app-select" value={tSectionId} onChange={(e) => setTSectionId(e.target.value)}>
                    <option value="">— Select later during seating setup —</option>
                  </select>
                  <p className="text-xs text-neutral-500">
                    Optional compatibility mapping for existing venue sections. Event-owned section mapping will replace this flow.
                  </p>
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
              {ticketSaving ? "Adding..." : "Add Ticket Class"}
            </Button>
          </div>
        )}

        {ticketClasses.length === 0 ? (
          <p className="text-sm text-neutral-500">No ticket classes yet. Add one above to get started.</p>
        ) : (
          <div className="space-y-3">
            {ticketClasses.map((ticket) => {
              const available = ticket.quantity - ticket.sold - ticket.reservedQty;
              const soldPct = Math.round((ticket.sold / ticket.quantity) * 100);
              return (
                <div key={ticket.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-neutral-900">{ticket.name}</span>
                        <Badge>{ticket.kind}</Badge>
                        <Badge className="border-transparent bg-violet-100 text-violet-700">
                          {formatTicketClassTypeLabel(ticket.classType)}
                        </Badge>
                        {ticket.eventSeatingSectionId || ticket.sectionId ? (
                          <Badge className="border-transparent bg-sky-100 text-sky-700">
                            {getTicketLayoutLabel(ticket)}
                          </Badge>
                        ) : ticket.classType === "general" ? (
                          <Badge className="border-transparent bg-neutral-100 text-neutral-500">GA</Badge>
                        ) : (
                          <Badge className="border-transparent bg-amber-100 text-amber-700">Unmapped</Badge>
                        )}
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

                  <div className="mt-3 grid gap-2 text-xs text-neutral-500 md:grid-cols-3">
                    <p>Reserved for comp: {ticket.reservedQty}</p>
                    <p>Comp issued: {ticket.compIssued}</p>
                    <p>Comp remaining: {Math.max(0, ticket.reservedQty - ticket.compIssued)}</p>
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
            { label: event.location?.type === "ONLINE" ? "Online Location" : "Venue", value: venueDisplayName },
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
          {inlineAddress && (
            <div className="md:col-span-2">
              <p className="text-sm text-neutral-500">Inline Location</p>
              <p className="whitespace-pre-wrap text-sm text-neutral-900">{inlineAddress}</p>
            </div>
          )}
          {event.description && (
            <div className="md:col-span-2">
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
          {event.customConfirmationMessage && (
            <div className="md:col-span-2">
              <p className="text-sm text-neutral-500">Custom Confirmation Message</p>
              <p className="text-sm whitespace-pre-wrap text-neutral-900">{event.customConfirmationMessage}</p>
            </div>
          )}
        </div>

        {event.status === "PUBLISHED" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Your event is live at <strong>/events/{event.slug}</strong>
          </div>
        )}
      </section>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Event Reviews</h2>
                <p className="mt-1 text-sm text-neutral-500">Read attendee feedback for this event. Visibility is moderated by admins.</p>
              </div>
              <Badge className="border-transparent bg-neutral-100 text-neutral-700">
                {event.reviews.length} review{event.reviews.length === 1 ? "" : "s"}
              </Badge>
            </div>

            {event.reviews.length === 0 ? (
              <p className="text-sm text-neutral-500">No reviews yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3">Attendee</th>
                      <th className="px-4 py-3">Comment</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Visible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {event.reviews.map((review) => (
                      <tr key={review.id}>
                        <td className="px-4 py-3 font-medium text-neutral-900">
                          {"★".repeat(review.rating)}
                          <span className="ml-2 text-neutral-500">{review.rating}/5</span>
                        </td>
                        <td className="px-4 py-3 text-neutral-700">{review.attendeeName}</td>
                        <td className="px-4 py-3 text-neutral-600">
                          {review.comment ? (
                            <span className="line-clamp-3 whitespace-pre-wrap">{review.comment}</span>
                          ) : (
                            <span className="text-neutral-400">No comment</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-500">{formatDateTime(review.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Badge className={review.isVisible ? "border-transparent bg-emerald-100 text-emerald-700" : "border-transparent bg-amber-100 text-amber-700"}>
                            {review.isVisible ? "Visible" : "Hidden"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </SidebarLayout>
  );
}
