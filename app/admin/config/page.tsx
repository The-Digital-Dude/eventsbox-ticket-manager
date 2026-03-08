"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

export default function AdminConfigPage() {
  const [commission, setCommission] = useState("8.5");
  const [gst, setGst] = useState("15");
  const [mode, setMode] = useState("MANUAL");

  useEffect(() => {
    fetch("/api/admin/config").then((r) => r.json()).then((p) => {
      if (!p?.data) return;
      setCommission(String(p.data.defaultCommissionPct));
      setGst(String(p.data.defaultGstPct));
      setMode(p.data.payoutModeDefault);
    });
  }, []);

  async function save() {
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultCommissionPct: Number(commission),
        defaultGstPct: Number(gst),
        payoutModeDefault: mode,
      }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to save config");
    toast.success("Config saved");
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Platform Config" subtitle="Default commission, GST and payout mode." />
      <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm md:grid-cols-3">
        <div className="space-y-2"><Label>Commission %</Label><Input value={commission} onChange={(e) => setCommission(e.target.value)} /></div>
        <div className="space-y-2"><Label>GST %</Label><Input value={gst} onChange={(e) => setGst(e.target.value)} /></div>
        <div className="space-y-2"><Label>Payout Default</Label><select className="app-select" value={mode} onChange={(e) => setMode(e.target.value)}><option value="MANUAL">MANUAL</option><option value="STRIPE_CONNECT">STRIPE_CONNECT</option></select></div>
        <Button onClick={save}>Save Config</Button>
      </div>
    </SidebarLayout>
  );
}
