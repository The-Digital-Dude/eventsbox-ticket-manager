"use client";

import { useEffect, useState } from "react";
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
import { PlacesAutocomplete } from "@/src/components/ui/places-autocomplete";
import { matchLocation } from "@/src/lib/location-match";
import { nav } from "@/app/organizer/nav";
import type { SeatState, VenueSeatingConfig } from "@/src/types/venue-seating";

type CountryRow = { id: string; code: string; name: string };
type CityRow = { id: string; name: string };
type StateRow = { id: string; name: string; countryId: string | null; cities: CityRow[] };
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

export default function OrganizerVenuesPage() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [step, setStep] = useState<Step>("details");
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetch, setRefetch] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [vRes, lRes, cRes] = await Promise.all([
        fetch("/api/organizer/venues"),
        fetch("/api/public/locations"),
        fetch("/api/public/categories"),
      ]);
      const v = await vRes.json();
      const l = await lRes.json();
      const c = await cRes.json();
      setVenues(v?.data ?? []);
      setCountries(l?.data?.countries ?? []);
      setStates(l?.data?.states ?? []);
      setCategories(c?.data ?? []);
      setLoading(false);
    }
    void load();
  }, [refetch]);

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
    setCountryId("");
    setStateId("");
    setCityId("");
    setCategoryId("");
    setLat(undefined);
    setLng(undefined);
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
        countryId: countryId || undefined,
        stateId,
        cityId,
        categoryId: categoryId || undefined,
        lat,
        lng,
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
    setRefetch(c => c + 1);
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
    setRefetch(c => c + 1);
  }

  function startEditSeating(venueId: string) {
    setEditingVenueId(venueId);
    setStep("seating");
  }

  const editingVenue = venues.find((venue) => venue.id === editingVenueId) ?? null;

  if (loading) {
    return (
      <SidebarLayout role="organizer" title="Organizer" items={nav}>
        <PageHeader title="Venue Requests" subtitle="Step 1: venue details. Step 2: seating configuration." />
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="h-64 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Venue Requests" subtitle="Step 1: venue details. Step 2: seating configuration." />

      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setStep("details")}
            className={`cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition ${step === "details" ? "bg-[var(--theme-accent)] text-white shadow-sm" : "border border-[var(--border)] text-neutral-600 hover:bg-neutral-50"}`}
          >
            Step 1 · Details
          </button>
          <button
            onClick={() => setStep("seating")}
            className={`cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition ${step === "seating" ? "bg-[var(--theme-accent)] text-white shadow-sm" : "border border-[var(--border)] text-neutral-600 hover:bg-neutral-50"}`}
          >
            Step 2 · Seating
          </button>
          {editingVenue ? (
            <span className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-neutral-500">
              Edit mode: {editingVenue.name}
            </span>
          ) : null}
        </div>

        {step === "details" ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Search Address</Label>
              <PlacesAutocomplete
                placeholder="Start typing an address to search..."
                onSelect={(place) => {
                  if (place.address) setAddressLine1(place.address);
                  if (place.lat !== undefined) setLat(place.lat);
                  if (place.lng !== undefined) setLng(place.lng);
                  const { countryId: cId, stateId: sId, cityId: ciId } = matchLocation(place, { countries, states });
                  if (cId) setCountryId(cId);
                  if (sId) setStateId(sId); else setStateId("");
                  if (ciId) setCityId(ciId); else setCityId("");
                  toast.success("Address auto-filled from Google Maps");
                }}
              />
              <p className="text-xs text-neutral-500">Select from suggestions to auto-fill address fields below.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><Label>Venue Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
              <div className="space-y-2"><Label>Category</Label><select className="app-select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Select category (optional)</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
              <div className="space-y-2 md:col-span-2"><Label>Address line 1</Label><Input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Address line 2</Label><Input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} /></div>
              <div className="space-y-2"><Label>Country</Label><select className="app-select" value={countryId} onChange={(event) => { setCountryId(event.target.value); setStateId(""); setCityId(""); }}><option value="">Select country (optional)</option>{countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}</select></div>
              <div className="space-y-2">
                <Label>State</Label>
                <div className="flex h-10 w-full items-center rounded-xl border border-[var(--border)] bg-neutral-50 px-3 text-sm cursor-not-allowed select-none">
                  {stateId ? <span className="text-neutral-900">{states.find((s) => s.id === stateId)?.name ?? "—"}</span> : <span className="text-neutral-400">Auto-filled from address search</span>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <div className="flex h-10 w-full items-center rounded-xl border border-[var(--border)] bg-neutral-50 px-3 text-sm cursor-not-allowed select-none">
                  {cityId ? <span className="text-neutral-900">{states.flatMap((s) => s.cities).find((c) => c.id === cityId)?.name ?? "—"}</span> : <span className="text-neutral-400">Auto-filled from address search</span>}
                </div>
              </div>
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
