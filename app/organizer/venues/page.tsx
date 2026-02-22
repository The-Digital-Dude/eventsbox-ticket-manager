"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState } from "@/src/components/shared/empty-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";

type CityRow = { id: string; name: string };
type StateRow = { id: string; name: string; cities: CityRow[] };
type VenueRow = { id: string; name: string; addressLine1: string; status: string };

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
];

export default function OrganizerVenuesPage() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [states, setStates] = useState<StateRow[]>([]);

  async function load() {
    const [vRes, lRes] = await Promise.all([fetch("/api/organizer/venues"), fetch("/api/public/locations")]);
    const v = await vRes.json();
    const l = await lRes.json();
    setVenues(v?.data ?? []);
    setStates(l?.data ?? []);
  }

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/organizer/venues").then((r) => r.json()), fetch("/api/public/locations").then((r) => r.json())])
      .then(([v, l]) => {
        if (!active) return;
        setVenues(v?.data ?? []);
        setStates(l?.data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  async function requestVenue() {
    const res = await fetch("/api/organizer/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, addressLine1: address, stateId, cityId }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to request venue");
    toast.success("Venue request submitted");
    setName("");
    setAddress("");
    await load();
  }

  const cities = states.find((s) => s.id === stateId)?.cities ?? [];

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Venue Requests" subtitle="Create venue requests and track admin decisions." />
      <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-6 md:grid-cols-2">
        <div className="space-y-2"><Label>Venue Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="space-y-2"><Label>State</Label><select className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm" value={stateId} onChange={(e) => setStateId(e.target.value)}><option value="">Select state</option>{states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="space-y-2"><Label>City</Label><select className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm" value={cityId} onChange={(e) => setCityId(e.target.value)}><option value="">Select city</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <Button onClick={requestVenue}>Submit Venue Request</Button>
      </div>
      {venues.length === 0 ? <EmptyState title="No venue requests yet" subtitle="Submit your first venue request to start onboarding locations." /> : null}
      <div className="grid gap-3">
        {venues.map((venue) => (
          <div key={venue.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="font-medium">{venue.name}</p>
            <p className="text-sm text-neutral-600">{venue.addressLine1}</p>
            <Badge className="mt-2">{venue.status}</Badge>
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}
