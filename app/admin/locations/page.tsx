"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";

type CountryRow = { id: string; code: string; name: string; isActive: boolean };
type StateRow = { id: string; code: string; name: string };
type CityRow = { id: string; name: string; state: { name: string } };

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/attendees", label: "Attendees" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

export default function AdminLocationsPage() {
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [countryName, setCountryName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [stateName, setStateName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [cityName, setCityName] = useState("");
  const [cityStateId, setCityStateId] = useState("");

  async function load() {
    const [coRes, sRes, cRes] = await Promise.all([
      fetch("/api/admin/locations/countries"),
      fetch("/api/admin/locations/states"),
      fetch("/api/admin/locations/cities"),
    ]);
    const co = await coRes.json();
    const s = await sRes.json();
    const c = await cRes.json();
    setCountries(co?.data ?? []);
    setStates(s?.data ?? []);
    setCities(c?.data ?? []);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/locations/countries").then((r) => r.json()),
      fetch("/api/admin/locations/states").then((r) => r.json()),
      fetch("/api/admin/locations/cities").then((r) => r.json()),
    ]).then(([co, s, c]) => {
      if (!active) return;
      setCountries(co?.data ?? []);
      setStates(s?.data ?? []);
      setCities(c?.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  async function addCountry() {
    if (countryCode.length !== 2) return toast.error("Country code must be exactly 2 letters (ISO 3166-1 alpha-2)");
    const res = await fetch("/api/admin/locations/countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: countryName, code: countryCode.toUpperCase() }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to add country");
    setCountryName("");
    setCountryCode("");
    await load();
  }

  async function addState() {
    const res = await fetch("/api/admin/locations/states", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: stateName, code: stateCode }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to add state");
    setStateName("");
    setStateCode("");
    await load();
  }

  async function addCity() {
    const res = await fetch("/api/admin/locations/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stateId: cityStateId, name: cityName }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Failed to add city");
    setCityName("");
    await load();
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Locations" subtitle="Manage countries, states and cities used for onboarding." />
      <Tabs defaultValue="countries">
        <TabsList>
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
        </TabsList>
        <TabsContent value="countries" className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="grid gap-2 md:grid-cols-3">
            <Input placeholder="ISO Code (e.g. US)" maxLength={2} value={countryCode} onChange={(e) => setCountryCode(e.target.value)} />
            <Input placeholder="Country name" value={countryName} onChange={(e) => setCountryName(e.target.value)} />
            <Button onClick={addCountry}>Add Country</Button>
          </div>
          {countries.map((country) => (
            <div key={country.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm flex items-center justify-between">
              <span>{country.code} - {country.name}</span>
              {!country.isActive && <span className="text-xs text-neutral-400">inactive</span>}
            </div>
          ))}
        </TabsContent>
        <TabsContent value="states" className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="grid gap-2 md:grid-cols-3">
            <Input placeholder="Code" value={stateCode} onChange={(e) => setStateCode(e.target.value)} />
            <Input placeholder="State name" value={stateName} onChange={(e) => setStateName(e.target.value)} />
            <Button onClick={addState}>Add State</Button>
          </div>
          {states.map((state) => <div key={state.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">{state.code} - {state.name}</div>)}
        </TabsContent>
        <TabsContent value="cities" className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="grid gap-2 md:grid-cols-3">
            <select className="app-select" value={cityStateId} onChange={(e) => setCityStateId(e.target.value)}>
              <option value="">Choose state</option>
              {states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}
            </select>
            <Input placeholder="City name" value={cityName} onChange={(e) => setCityName(e.target.value)} />
            <Button onClick={addCity}>Add City</Button>
          </div>
          {cities.map((city) => <div key={city.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">{city.name} ({city.state.name})</div>)}
        </TabsContent>
      </Tabs>
    </SidebarLayout>
  );
}
