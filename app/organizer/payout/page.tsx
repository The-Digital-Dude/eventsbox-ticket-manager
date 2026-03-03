"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, CreditCard, ExternalLink, Landmark, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Badge } from "@/src/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";

type PayoutSettings = {
  payoutMode: "MANUAL" | "STRIPE_CONNECT";
  manualPayoutNote?: string | null;
  stripeAccountId?: string | null;
  stripeOnboardingStatus?: "NOT_STARTED" | "PENDING" | "COMPLETED" | null;
};

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
];

export default function OrganizerPayoutPage() {
  const [manualNote, setManualNote] = useState("");
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isStartingStripe, setIsStartingStripe] = useState(false);
  const [isOpeningExpressDashboard, setIsOpeningExpressDashboard] = useState(false);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/organizer/payout");
      const payload = await res.json();
      if (payload?.data) {
        setSettings(payload.data);
        if (payload.data.manualPayoutNote) setManualNote(payload.data.manualPayoutNote);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function saveManual() {
    setIsSavingManual(true);
    const res = await fetch("/api/organizer/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutMode: "MANUAL", manualPayoutNote: manualNote }),
    });
    const payload = await res.json();
    setIsSavingManual(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to save manual payout");
    toast.success("Manual payout settings saved");
    await loadSettings();
  }

  async function startStripe() {
    setIsStartingStripe(true);
    const res = await fetch("/api/organizer/payout/start-stripe", { method: "POST" });
    const payload = await res.json();
    setIsStartingStripe(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to start Stripe flow");
    window.location.href = payload.data.url;
  }

  async function openExpressDashboard() {
    setIsOpeningExpressDashboard(true);
    const res = await fetch("/api/organizer/payout/express-dashboard", { method: "POST" });
    const payload = await res.json();
    setIsOpeningExpressDashboard(false);
    if (!res.ok) return toast.error(payload?.error?.message ?? "Unable to open Stripe Express dashboard");
    window.open(payload.data.url, "_blank", "noopener,noreferrer");
  }

  const stripeStatus = settings?.stripeOnboardingStatus ?? "NOT_STARTED";
  const stripeReady = stripeStatus === "COMPLETED";
  const currentMode = settings?.payoutMode === "STRIPE_CONNECT" ? "stripe" : "manual";
  const stripeStatusLabel =
    stripeStatus === "COMPLETED"
      ? "Ready for payouts"
      : stripeStatus === "PENDING"
        ? "Onboarding in progress"
        : "Not started";

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Payout Settings" subtitle="Choose Stripe Connect or manual settlement." />
      <section className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.24)] bg-[rgb(var(--theme-accent-rgb)/0.08)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-transparent bg-[var(--theme-accent)] text-white">
                {currentMode === "stripe" ? "Stripe Connect" : "Manual payout"}
              </Badge>
              <Badge>{stripeStatusLabel}</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Payout path for organizer settlements</h2>
            <p className="max-w-2xl text-sm text-neutral-700">
              Connect a real Stripe Express account to receive automated payouts, or keep a manual fallback note for internal settlement.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white/85 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-600">
                <ShieldCheck className="h-4 w-4 text-[var(--theme-accent)]" />
                Status
              </div>
              <p className="text-lg font-semibold text-neutral-900">{stripeStatusLabel}</p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white/85 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-600">
                <CreditCard className="h-4 w-4 text-[var(--theme-accent)]" />
                Stripe Account
              </div>
              <p className="truncate text-sm font-semibold text-neutral-900">{settings?.stripeAccountId ?? "Not created yet"}</p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white/85 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-600">
                <Landmark className="h-4 w-4 text-[var(--theme-accent)]" />
                Active Mode
              </div>
              <p className="text-lg font-semibold text-neutral-900">{currentMode === "stripe" ? "Stripe Connect" : "Manual"}</p>
            </div>
          </div>
        </div>
      </section>
      <Tabs defaultValue={currentMode}>
        <TabsList>
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="stripe">Stripe Connect</TabsTrigger>
        </TabsList>
        <TabsContent value="manual" className="mt-4 space-y-4 rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-neutral-900">Manual settlement fallback</h3>
            <p className="text-sm text-neutral-600">Store bank or settlement instructions here in case you want to process organizer payouts manually.</p>
          </div>
          <div className="space-y-2">
            <Label>Settlement Note</Label>
            <Input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Bank details or internal payout instruction" />
          </div>
          <Button onClick={saveManual} disabled={isSavingManual}>{isSavingManual ? "Saving..." : "Save Manual Settings"}</Button>
        </TabsContent>
        <TabsContent value="stripe" className="mt-4 space-y-4 rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-neutral-900">Stripe Connect Express</h3>
              <p className="text-sm text-neutral-600">Use Stripe to onboard organizers securely and receive real payouts to their connected account.</p>
            </div>
            <Badge className={stripeReady ? "border-transparent bg-emerald-100 text-emerald-700" : ""}>
              {stripeStatusLabel}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700">
                <CreditCard className="h-4 w-4 text-[var(--theme-accent)]" />
                Account ID
              </div>
              <p className="break-all text-sm text-neutral-900">{settings?.stripeAccountId ?? "No Stripe account connected yet."}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700">
                <Clock3 className="h-4 w-4 text-[var(--theme-accent)]" />
                Onboarding
              </div>
              <p className="text-sm text-neutral-900">{stripeStatus === "PENDING" ? "Complete the remaining Stripe steps." : stripeReady ? "Stripe has received completed onboarding details." : "Start onboarding to create a connected account."}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700">
                <CheckCircle2 className="h-4 w-4 text-[var(--theme-accent)]" />
                Recommended
              </div>
              <p className="text-sm text-neutral-900">Use Stripe Connect for automated organizer payouts and easier compliance handling.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {!stripeReady ? (
              <Button onClick={startStripe} disabled={isStartingStripe || isLoading}>
                {isStartingStripe
                  ? "Redirecting..."
                  : stripeStatus === "PENDING"
                    ? "Continue Stripe Onboarding"
                    : "Start Stripe Onboarding"}
              </Button>
            ) : null}
            {settings?.stripeAccountId ? (
              <button
                type="button"
                onClick={openExpressDashboard}
                disabled={isOpeningExpressDashboard}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-[rgb(var(--theme-accent-rgb)/0.05)]"
              >
                {isOpeningExpressDashboard ? "Opening Stripe..." : "Open Stripe Express Dashboard"}
                <ExternalLink className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </SidebarLayout>
  );
}
