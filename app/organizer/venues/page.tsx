"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState } from "@/src/components/shared/empty-state";
import { LayoutBuilderShell } from "@/src/components/organizer/layout-builder-shell";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { PlacesAutocomplete } from "@/src/components/ui/places-autocomplete";
import { SearchableSelect } from "@/src/components/ui/searchable-select";
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
type EventContext = {
  id: string;
  title: string;
  venueId: string | null;
  venueName: string | null;
  layoutMode: string | null;
};

function formatLayoutMode(layoutMode: string | null) {
  switch (layoutMode) {
    case "ROWS":
      return "seating layout";
    case "TABLES":
      return "table layout";
    case "MIXED":
      return "mixed layout";
    default:
      return "venue setup";
  }
}

export default function OrganizerVenuesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [stateName, setStateName] = useState("");
  const [cityName, setCityName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [step, setStep] = useState<Step>("details");
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [eventContext, setEventContext] = useState<EventContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetch, setRefetch] = useState(0);
  const eventId = searchParams.get("eventId");
  const incomingStep = searchParams.get("step");
  const incomingVenueId = searchParams.get("venueId");
  const incomingLayoutMode = searchParams.get("layoutMode");
  const isTicketFlow = searchParams.get("from") === "ticket" || searchParams.get("from") === "ticket-class";
  const filteredStates = states.filter((state) => !countryId || state.countryId === countryId);
  const cities = filteredStates.find((state) => state.id === stateId)?.cities ?? [];

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [vRes, lRes, cRes, eRes] = await Promise.all([
        fetch("/api/organizer/venues"),
        fetch("/api/public/locations"),
        fetch("/api/public/categories"),
        eventId ? fetch(`/api/organizer/events/${eventId}`) : Promise.resolve(null),
      ]);
      const v = await vRes.json();
      const l = await lRes.json();
      const c = await cRes.json();
      const eventPayload = eRes ? await eRes.json() : null;
      setVenues(v?.data ?? []);
      setCountries(l?.data?.countries ?? []);
      setStates(l?.data?.states ?? []);
      setCategories(c?.data ?? []);
      if (eventPayload?.data) {
        setEventContext({
          id: eventPayload.data.id,
          title: eventPayload.data.title,
          venueId: eventPayload.data.venue?.id ?? null,
          venueName: eventPayload.data.venue?.name ?? null,
          layoutMode: incomingLayoutMode ?? eventPayload.data.seatingMode ?? null,
        });
      } else {
        setEventContext(null);
      }
      const initialEditingVenueId = incomingVenueId ?? eventPayload?.data?.venue?.id ?? null;
      const requestedStep: Step =
        incomingStep === "seating" || (isTicketFlow && initialEditingVenueId)
          ? "seating"
          : "details";
      const nextStep: Step = requestedStep === "seating" && !initialEditingVenueId ? "details" : requestedStep;
      setStep(nextStep);
      if (nextStep === "seating") {
        setEditingVenueId(initialEditingVenueId);
      } else {
        setEditingVenueId(null);
      }
      setLoading(false);
    }
    void load();
  }, [eventId, incomingStep, incomingVenueId, incomingLayoutMode, isTicketFlow, refetch]);

  function validateDetails() {
    if (!name.trim()) {
      toast.error("Venue name is required");
      return false;
    }
    if (!addressLine1.trim()) {
      toast.error("Address line 1 is required");
      return false;
    }
    if (!stateId && !stateName.trim()) {
      toast.error("Please select or enter a state");
      return false;
    }
    if (!cityId && !cityName.trim()) {
      toast.error("Please select or enter a city");
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
    setStateName("");
    setCityName("");
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
        stateId: stateId || undefined,
        stateName: stateName.trim() || undefined,
        cityId: cityId || undefined,
        cityName: cityName.trim() || undefined,
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

    const createdVenueId = response?.data?.id as string | undefined;
    if (isTicketFlow && eventContext?.id && createdVenueId) {
      const linkRes = await fetch(`/api/organizer/events/${eventContext.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: createdVenueId,
          countryId: countryId || undefined,
          stateId: (response?.data?.stateId ?? stateId) || undefined,
          stateName: stateName.trim() || undefined,
          cityId: (response?.data?.cityId ?? cityId) || undefined,
          cityName: cityName.trim() || undefined,
          ...(lat !== undefined ? { lat } : {}),
          ...(lng !== undefined ? { lng } : {}),
        }),
      });
      const linkPayload = await linkRes.json();
      if (!linkRes.ok) {
        toast.error(linkPayload?.error?.message ?? "Venue was created, but linking it to the event failed");
        setRefetch(c => c + 1);
        return;
      }
    }

    toast.success("Venue and seating configuration submitted");
    resetForm();
    setRefetch(c => c + 1);
    if (isTicketFlow && eventContext?.id) {
      router.push(`/organizer/events/${eventContext.id}`);
    }
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

      {isTicketFlow && eventContext ? (
        <div className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.05)] px-5 py-4 text-sm text-neutral-700 shadow-sm">
          <p className="font-medium text-neutral-900">Continuing setup for {eventContext.title}</p>
          <p className="mt-1">
            {eventContext.venueId
              ? `Venue${eventContext.venueName ? ` "${eventContext.venueName}"` : ""} is already linked. Continue with ${formatLayoutMode(eventContext.layoutMode)} below.`
              : `Create the venue details first, then continue into ${formatLayoutMode(eventContext.layoutMode)}.`}
          </p>
          <div className="mt-3">
            <Link href={`/organizer/events/${eventContext.id}`} className="text-sm font-medium text-[var(--theme-accent)] underline underline-offset-4">
              Back to event
            </Link>
          </div>
        </div>
      ) : null}

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
                  setStateName("");
                  setCityName("");
                  toast.success("Address auto-filled from Google Maps");
                }}
              />
              <p className="text-xs text-neutral-500">Use autocomplete when available, or choose country, state, and city manually below.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><Label>Venue Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
              <div className="space-y-2"><Label>Category</Label><select className="app-select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Select category (optional)</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
              <div className="space-y-2 md:col-span-2"><Label>Address line 1</Label><Input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Address line 2</Label><Input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} /></div>
              <div className="space-y-2">
                <Label>Country</Label>
                <SearchableSelect
                  options={[{ value: "", label: "Select country (optional)" }, ...countries.map((country) => ({ value: country.id, label: country.name }))]}
                  value={countryId}
                  onChange={(value) => { setCountryId(value); setStateId(""); setCityId(""); }}
                  placeholder="Select country (optional)"
                  searchPlaceholder="Search countries..."
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <SearchableSelect
                  options={[{ value: "", label: "Select state" }, ...filteredStates.map((state) => ({ value: state.id, label: state.name }))]}
                  value={stateId}
                  onChange={(value) => { setStateId(value); setCityId(""); if (value) setStateName(""); }}
                  placeholder="Select state"
                  searchPlaceholder="Search states..."
                  disabled={!countryId}
                />
                <Input
                  value={stateName}
                  onChange={(event) => { setStateName(event.target.value); if (event.target.value.trim()) setStateId(""); }}
                  placeholder="Or type state manually"
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <SearchableSelect
                  options={[{ value: "", label: "Select city" }, ...cities.map((city) => ({ value: city.id, label: city.name }))]}
                  value={cityId}
                  onChange={(value) => { setCityId(value); if (value) setCityName(""); }}
                  placeholder="Select city"
                  searchPlaceholder="Search cities..."
                  disabled={!stateId}
                />
                <Input
                  value={cityName}
                  onChange={(event) => { setCityName(event.target.value); if (event.target.value.trim()) setCityId(""); }}
                  placeholder="Or type city manually"
                />
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
                ? `Updating ${formatLayoutMode(eventContext?.layoutMode ?? null)} for an existing venue.`
                : `Configure the existing seat map builder for this ${formatLayoutMode(eventContext?.layoutMode ?? null)}.`}
            </p>
            <LayoutBuilderShell
              title="Venue Seating Builder"
              description={
                editingVenue
                  ? `Updating ${formatLayoutMode(eventContext?.layoutMode ?? null)} for an existing venue.`
                  : `Configure the existing seat map builder for this ${formatLayoutMode(eventContext?.layoutMode ?? null)}.`
              }
              initialConfig={editingVenue?.seatingConfig ?? null}
              initialSeatState={editingVenue?.seatState ?? null}
              saveLabel={editingVenue ? "Save Seating Update" : "Submit Venue Request"}
              onSave={(payload) =>
                editingVenue
                  ? saveExistingVenueSeating(editingVenue.id, payload)
                  : submitNewVenue(payload)
              }
              backLabel="Back to Details"
              onBack={() => setStep("details")}
              ticketClasses={[]}
            />
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
