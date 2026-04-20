"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { nav } from "@/app/organizer/nav";
import { LayoutBuilderShell } from "@/src/components/organizer/layout-builder-shell";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";

type TicketClassSummary = {
  id: string;
  name: string;
  classType: string;
  isActive: boolean;
  quantity?: number;
  eventSeatingSectionId?: string | null;
};

type LayoutPayload = {
  event: {
    id: string;
    title: string;
    status: string;
    seatingMode: string;
    venue: { id: string; name: string; addressLine1: string } | null;
    ticketClasses: TicketClassSummary[];
  };
  layoutDecision: {
    layoutType: "none" | "seating" | "table" | "mixed";
    eventSeatingMode: "GA_ONLY" | "ROWS" | "TABLES" | "MIXED";
    requiresLayout: boolean;
  };
  seating: {
    source: "event" | "venue" | "none";
    seatingConfig: VenueSeatingConfig | null;
    seatState: Record<string, SeatState> | null;
  };
  sections: Array<{
    id: string;
    key: string;
    name: string;
    sectionType: "ROWS" | "TABLES" | "SECTIONED_GA";
    capacity: number | null;
    usedQuantity: number;
    remainingCapacity: number | null;
  }>;
};

function formatLayoutType(layoutType: LayoutPayload["layoutDecision"]["layoutType"]) {
  switch (layoutType) {
    case "seating":
      return "Seating";
    case "table":
      return "Table";
    case "mixed":
      return "Mixed";
    default:
      return "None";
  }
}

export default function OrganizerEventLayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<LayoutPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMappings, setSavingMappings] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch(`/api/organizer/events/${id}/layout`);
    const payload = await res.json();
    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to load event layout");
      setLoading(false);
      return;
    }
    setData(payload.data);
    setAssignments(
      Object.fromEntries(
        (payload.data.event.ticketClasses as TicketClassSummary[]).map((ticketClass) => [
          ticketClass.id,
          ticketClass.eventSeatingSectionId ?? "",
        ]),
      ),
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function saveLayout(payload: {
    seatingConfig: VenueSeatingConfig;
    seatState?: Record<string, SeatState>;
    summary: { totalSeats: number; totalTables: number; sectionCount: number };
  }) {
    const res = await fetch(`/api/organizer/events/${id}/layout`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const response = await res.json();
    if (!res.ok) {
      toast.error(response?.error?.message ?? "Unable to save event layout");
      return;
    }
    toast.success("Event layout saved");
    await load();
  }

  async function saveMappings() {
    setSavingMappings(true);
    const res = await fetch(`/api/organizer/events/${id}/layout/mappings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignments: Object.entries(assignments).map(([ticketTypeId, eventSeatingSectionId]) => ({
          ticketTypeId,
          eventSeatingSectionId: eventSeatingSectionId || null,
        })),
      }),
    });
    const payload = await res.json();
    setSavingMappings(false);
    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to save ticket class mappings");
      return;
    }
    toast.success("Ticket class mappings saved");
    await load();
  }

  if (loading) {
    return (
      <SidebarLayout role="organizer" title="Organizer" items={nav}>
        <div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />
      </SidebarLayout>
    );
  }

  if (!data) {
    return (
      <SidebarLayout role="organizer" title="Organizer" items={nav}>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">Event layout could not be loaded.</p>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <div className="space-y-4">
        <Link href={`/organizer/events/${id}`} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
          <ChevronLeft className="h-4 w-4" /> Back to Event
        </Link>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{data.event.title}</h1>
              <p className="mt-1 text-sm text-neutral-600">
                Continue the event setup by configuring the layout with the existing seating map builder.
              </p>
            </div>
            <Badge>{formatLayoutType(data.layoutDecision.layoutType)} Layout</Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-neutral-600">
            <span className="rounded-full border border-[var(--border)] px-3 py-1">
              Layout source: {data.seating.source}
            </span>
            <span className="rounded-full border border-[var(--border)] px-3 py-1">
              Venue: {data.event.venue?.name ?? "Not linked"}
            </span>
          </div>

          {!data.event.venue && (
            <div className="mt-4 rounded-xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.05)] px-4 py-3 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">No venue linked yet</p>
              <p className="mt-1">
                You can continue building an event-owned layout now and attach or create the venue separately.
              </p>
              <div className="mt-3">
                <Link href={`/organizer/venues?from=event-layout&eventId=${id}&step=details`}>
                  <Button size="sm" variant="outline">Manage Venue Details</Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        <LayoutBuilderShell
          title="Event Layout Builder"
          description="This reuses the existing seating map builder and saves the layout under the event, so the organizer flow stays continuous."
          initialConfig={data.seating.seatingConfig}
          initialSeatState={data.seating.seatState}
          saveLabel="Save Event Layout"
          onSave={saveLayout}
          backLabel="Back to Event"
          onBack={() => {
            window.location.href = `/organizer/events/${id}`;
          }}
        />

        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Ticket Class Mapping</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Map each ticket class to general admission, a seating section, or a table group after saving the layout.
              </p>
            </div>
            <Button onClick={saveMappings} disabled={savingMappings || data.sections.length === 0}>
              {savingMappings ? "Saving..." : "Save Mappings"}
            </Button>
          </div>

          {data.sections.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">Save the event layout first to create layout sections that ticket classes can map to.</p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.sections.map((section) => (
                  <div key={section.id} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-neutral-900">{section.name}</p>
                      <Badge>{section.sectionType}</Badge>
                    </div>
                    <p className="mt-1 text-neutral-600">
                      Capacity: {section.capacity ?? "Unbounded"} · Used: {section.usedQuantity}
                      {section.remainingCapacity !== null ? ` · Remaining: ${section.remainingCapacity}` : ""}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                {data.event.ticketClasses.map((ticketClass) => {
                  const compatibleSections = data.sections.filter((section) => {
                    if (ticketClass.classType === "general") return false;
                    if (ticketClass.classType === "mixed") return true;
                    if (ticketClass.classType === "seating") return section.sectionType === "ROWS";
                    if (ticketClass.classType === "table") return section.sectionType === "TABLES";
                    return false;
                  });

                  return (
                    <div key={ticketClass.id} className="rounded-xl border border-[var(--border)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-neutral-900">{ticketClass.name}</p>
                          <p className="mt-1 text-sm text-neutral-600">
                            Type: {ticketClass.classType} · Quantity: {ticketClass.quantity ?? 0}
                          </p>
                        </div>
                        <Badge>{ticketClass.classType}</Badge>
                      </div>

                      {ticketClass.classType === "general" ? (
                        <p className="mt-3 text-sm text-neutral-500">General admission classes do not require a seating or table mapping.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <label className="text-sm font-medium text-neutral-700">Layout Target</label>
                          <select
                            className="app-select"
                            value={assignments[ticketClass.id] ?? ""}
                            onChange={(event) =>
                              setAssignments((current) => ({
                                ...current,
                                [ticketClass.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Unassigned</option>
                            {compatibleSections.map((section) => (
                              <option key={section.id} value={section.id}>
                                {section.name} ({section.sectionType})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
