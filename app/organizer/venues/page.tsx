"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState } from "@/src/components/shared/empty-state";
import { SeatMapBuilder } from "@/src/components/shared/seat-map-builder";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";

type CityRow = { id: string; name: string };
type StateRow = { id: string; name: string; cities: CityRow[] };
type CategoryRow = { id: string; name: string };
type VenueRow = {
  id: string;
  name: string;
  addressLine1: string;
  status: string;
  totalSeats: number | null;
  totalTables: number | null;
  seatingConfig?: VenueSeatingConfig | null;
  seatState?: Record<string, SeatState> | null;
};

type Step = "details" | "seating";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
  { href: "/organizer/cancellation-requests", label: "Cancellations" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

export default function OrganizerVenuesPage() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [states, setStates] = useState<StateRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [step, setStep] = useState<Step>("details");
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);

  async function load() {
    const [vRes, lRes, cRes] = await Promise.all([
      fetch("/api/organizer/venues"),
      fetch("/api/public/locations"),
      fetch("/api/public/categories"),
    ]);
    const v = await vRes.json();
    const l = await lRes.json();
    const c = await cRes.json();
    setVenues(v?.data ?? []);
    setStates(l?.data ?? []);
    setCategories(c?.data ?? []);
  }

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/organizer/venues").then((res) => res.json()), fetch("/api/public/locations").then((res) => res.json()), fetch("/api/public/categories").then((res) => res.json())]).then(
      ([v, l, c]) => {
        if (!active) return;
        setVenues(v?.data ?? []);
        setStates(l?.data ?? []);
        setCategories(c?.data ?? []);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const cities = useMemo(() => states.find((state) => state.id === stateId)?.cities ?? [], [states, stateId]);

  function validateDetails() {
    if (!name.trim()) {
      toast.error("Venue name is required");
      return false;
    }
    if (!addressLine1.trim()) {
      toast.error("Address line 1 is required");
      return false;
    }
    if (!stateId || !cityId) {
      toast.error("Please select state and city");
      return false;
    }
    return true;
  }

  function beginCreateWithSeating() {
    if (!validateDetails()) return;
    setEditingVenueId(null);
    setStep("seating");
  }

  function resetForm() {
    setName("");
    setAddressLine1("");
    setAddressLine2("");
    setStateId("");
    setCityId("");
    setCategoryId("");
    setEditingVenueId(null);
    setStep("details");
  }

  async function submitNewVenue(payload: {
    seatingConfig: VenueSeatingConfig;
    seatState?: Record<string, SeatState>;
    summary: { totalSeats: number; totalTables: number; sectionCount: number };
  }) {
    const res = await fetch("/api/organizer/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        addressLine1,
        addressLine2: addressLine2 || undefined,
        stateId,
        cityId,
        categoryId: categoryId || undefined,
        seatingConfig: payload.seatingConfig,
        seatState: payload.seatState,
        summary: payload.summary,
      }),
    });

    const response = await res.json();
    if (!res.ok) {
      toast.error(response?.error?.message ?? "Unable to create venue");
      return;
    }

    toast.success("Venue and seating configuration submitted");
    resetForm();
    await load();
  }

  async function saveExistingVenueSeating(
    venueId: string,
    payload: {
      seatingConfig: VenueSeatingConfig;
      seatState?: Record<string, SeatState>;
      summary: { totalSeats: number; totalTables: number; sectionCount: number };
    },
  ) {
    const res = await fetch(`/api/organizer/venues/${venueId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const response = await res.json();
    if (!res.ok) {
      toast.error(response?.error?.message ?? "Unable to update venue seating");
      return;
    }

    toast.success("Venue seating updated");
    resetForm();
    await load();
  }

  function startEditSeating(venueId: string) {
    setEditingVenueId(venueId);
    setStep("seating");
  }

  const editingVenue = venues.find((venue) => venue.id === editingVenueId) ?? null;

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Venue Requests" subtitle="Step 1: venue details. Step 2: seating configuration." />

      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Badge className={step === "details" ? "border-transparent bg-[var(--theme-accent)] text-white" : ""}>Step 1 Details</Badge>
          <Badge className={step === "seating" ? "border-transparent bg-[var(--theme-accent)] text-white" : ""}>Step 2 Seating</Badge>
          {editingVenue ? <Badge>Edit mode: {editingVenue.name}</Badge> : null}
        </div>

        {step === "details" ? (
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><Label>Venue Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
              <div className="space-y-2"><Label>Category</Label><select className="app-select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Select category (optional)</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
              <div className="space-y-2 md:col-span-2"><Label>Address line 1</Label><Input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Address line 2</Label><Input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} /></div>
              <div className="space-y-2"><Label>State</Label><select className="app-select" value={stateId} onChange={(event) => { setStateId(event.target.value); setCityId(""); }}><option value="">Select state</option>{states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select></div>
              <div className="space-y-2"><Label>City</Label><select className="app-select" value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">Select city</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></div>
            </div>
            <div className="flex gap-3">
              <Button onClick={beginCreateWithSeating}>Next: Seating Configuration</Button>
              <Button variant="outline" onClick={resetForm}>Reset</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {editingVenue
                ? "Updating seating for an existing venue."
                : "Configure seating map sections and submit the venue request."}
            </p>
            <SeatMapBuilder
              initialConfig={editingVenue?.seatingConfig ?? null}
              initialSeatState={editingVenue?.seatState ?? null}
              saveLabel={editingVenue ? "Save Seating Update" : "Submit Venue Request"}
              onSave={(payload) =>
                editingVenue
                  ? saveExistingVenueSeating(editingVenue.id, payload)
                  : submitNewVenue(payload)
              }
            />
            <Button variant="outline" onClick={() => setStep("details")}>Back to Details</Button>
          </div>
        )}
      </div>

      {venues.length === 0 ? (
        <EmptyState title="No venue requests yet" subtitle="Add venue details and configure seats/tables in step 2." />
      ) : null}

      <div className="grid gap-4">
        {venues.map((venue) => (
          <article
            key={venue.id}
            className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.24)] bg-gradient-to-br from-white via-white to-[rgb(var(--theme-accent-rgb)/0.08)] p-5 shadow-sm transition hover:border-[rgb(var(--theme-accent-rgb)/0.34)] hover:shadow-[0_16px_38px_rgb(var(--theme-accent-rgb)/0.12)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--theme-accent-rgb)/0.08)] px-2.5 py-1 text-xs font-semibold text-[var(--theme-accent)]">
                  <Building2 className="h-3.5 w-3.5" />
                  {venue.status === "APPROVED" ? "Venue" : "Venue Request"}
                </div>
                <p className="truncate text-2xl font-semibold tracking-tight text-neutral-900">{venue.name}</p>
                <div className="inline-flex items-center gap-1.5 text-sm text-neutral-700">
                  <MapPin className="h-4 w-4 text-[var(--theme-secondary)]" />
                  <span className="truncate">{venue.addressLine1}</span>
                </div>
              </div>
              <Badge>{venue.status}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white/85 px-3 py-2">
                <p className="text-neutral-500">Total seats</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{venue.totalSeats ?? 0}</p>
              </div>
              <div className="rounded-xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white/85 px-3 py-2">
                <p className="text-neutral-500">Total tables</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{venue.totalTables ?? 0}</p>
              </div>
            </div>
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => startEditSeating(venue.id)}>Edit Seating</Button>
            </div>
          </article>
        ))}
      </div>
    </SidebarLayout>
  );
}
