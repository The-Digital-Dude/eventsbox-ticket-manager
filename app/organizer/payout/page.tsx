"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
];

export default function OrganizerPayoutPage() {
  const [manualNote, setManualNote] = useState("");

  useEffect(() => {
    fetch("/api/organizer/payout").then((r) => r.json()).then((p) => {
      if (p?.data?.manualPayoutNote) setManualNote(p.data.manualPayoutNote);
    });
  }, []);

  async function saveManual() {
    const res = await fetch("/api/organizer/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutMode: "MANUAL", manualPayoutNote: manualNote }),
    });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to save manual payout");
    toast.success("Manual payout settings saved");
  }

  async function startStripe() {
    const res = await fetch("/api/organizer/payout/start-stripe", { method: "POST" });
    const payload = await res.json();
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to start Stripe flow");
    window.location.href = payload.data.url;
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Payout Settings" subtitle="Choose Stripe Connect or manual settlement." />
      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="stripe">Stripe Connect</TabsTrigger>
        </TabsList>
        <TabsContent value="manual" className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <Label>Settlement Note</Label>
          <Input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Bank details or instruction" />
          <Button onClick={saveManual}>Save Manual Settings</Button>
        </TabsContent>
        <TabsContent value="stripe" className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">Use Stripe Connect Express for payouts.</p>
          <Button onClick={startStripe}>Start Stripe Onboarding</Button>
        </TabsContent>
      </Tabs>
    </SidebarLayout>
  );
}
