"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";

type StateRow = { id: string; code: string; name: string };
type CityRow = { id: string; name: string; state: { name: string } };

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

export default function AdminLocationsPage() {
  const [states, setStates] = useState<StateRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [stateName, setStateName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [cityName, setCityName] = useState("");
  const [cityStateId, setCityStateId] = useState("");

  async function load() {
    const [sRes, cRes] = await Promise.all([fetch("/api/admin/locations/states"), fetch("/api/admin/locations/cities")]);
    const s = await sRes.json();
    const c = await cRes.json();
    setStates(s?.data ?? []);
    setCities(c?.data ?? []);
  }

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/admin/locations/states").then((r) => r.json()), fetch("/api/admin/locations/cities").then((r) => r.json())])
      .then(([s, c]) => {
        if (!active) return;
        setStates(s?.data ?? []);
        setCities(c?.data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

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
      <PageHeader title="Locations" subtitle="Manage states and cities used for onboarding." />
      <Tabs defaultValue="states">
        <TabsList>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="cities">Cities</TabsTrigger>
        </TabsList>
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
