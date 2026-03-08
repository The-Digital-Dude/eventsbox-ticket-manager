"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, CreditCard, ExternalLink, Landmark, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Badge } from "@/src/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";

type PayoutSettings = {
  payoutMode: "MANUAL" | "STRIPE_CONNECT";
  manualPayoutNote?: string | null;
  stripeAccountId?: string | null;
  stripeOnboardingStatus?: "NOT_STARTED" | "PENDING" | "COMPLETED" | null;
};

type PayoutRequestRow = {
  id: string;
  amount: number | string | null;
  note: string | null;
  status: "PENDING" | "APPROVED" | "PAID" | "REJECTED";
  adminNote: string | null;
  requestedAt: string;
};

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

function requestStatusClass(status: PayoutRequestRow["status"]) {
  if (status === "APPROVED") return "bg-blue-100 text-blue-700 border-transparent";
  if (status === "PAID") return "bg-emerald-100 text-emerald-700 border-transparent";
  if (status === "REJECTED") return "bg-red-100 text-red-700 border-transparent";
  return "bg-amber-100 text-amber-700 border-transparent";
}

function formatAmount(value: number | string | null) {
  if (value === null || value === undefined) return "—";
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return "—";
  return `$${normalized.toFixed(2)}`;
}

export default function OrganizerPayoutPage() {
  const [manualNote, setManualNote] = useState("");
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [requests, setRequests] = useState<PayoutRequestRow[]>([]);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isStartingStripe, setIsStartingStripe] = useState(false);
  const [isOpeningExpressDashboard, setIsOpeningExpressDashboard] = useState(false);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const [settingsRes, requestsRes] = await Promise.all([
        fetch("/api/organizer/payout"),
        fetch("/api/organizer/payout/requests"),
      ]);
      const [settingsPayload, requestsPayload] = await Promise.all([settingsRes.json(), requestsRes.json()]);

      if (settingsPayload?.data) {
        setSettings(settingsPayload.data);
        setManualNote(settingsPayload.data.manualPayoutNote ?? "");
      }

      if (requestsRes.ok) {
        setRequests((requestsPayload?.data ?? []) as PayoutRequestRow[]);
      } else {
        setRequests([]);
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

  async function requestPayout() {
    setIsSubmittingRequest(true);
    const amountValue = requestAmount.trim() ? Number(requestAmount) : undefined;
    const res = await fetch("/api/organizer/payout/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountValue,
        note: requestNote.trim() || undefined,
      }),
    });
    const payload = await res.json();
    setIsSubmittingRequest(false);

    if (!res.ok) {
      return toast.error(payload?.error?.message ?? "Unable to request payout");
    }

    toast.success("Payout request submitted");
    setRequestAmount("");
    setRequestNote("");
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
  const isManualMode = settings?.payoutMode !== "STRIPE_CONNECT";
  const hasPendingRequest = useMemo(() => requests.some((request) => request.status === "PENDING"), [requests]);

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
          {!isManualMode ? (
            <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              Manual payout requests are hidden because your account is currently on Stripe Connect mode.
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white p-6 shadow-sm">
                <div className="space-y-1">
                  <h3 className="mb-4 text-lg font-semibold text-neutral-900">Request a Payout</h3>
                  <p className="text-sm text-neutral-600">Submit a manual payout request for admin review.</p>
                </div>

                {hasPendingRequest ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    You have a pending payout request. Wait for admin review before submitting another.
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Amount (Optional)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount (optional)"
                      value={requestAmount}
                      onChange={(event) => setRequestAmount(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Note (Optional)</Label>
                    <textarea
                      className="h-24 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.25)]"
                      placeholder="Add a note for the admin (optional)"
                      maxLength={500}
                      value={requestNote}
                      onChange={(event) => setRequestNote(event.target.value)}
                    />
                  </div>
                </div>

                <Button className="mt-4" onClick={requestPayout} disabled={isSubmittingRequest || hasPendingRequest || isLoading}>
                  {isSubmittingRequest ? "Submitting..." : "Request Payout"}
                </Button>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-neutral-900">Payout Request History</h3>
                {requests.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm text-neutral-600">No payout requests yet.</div>
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Note</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Admin Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>{new Date(request.requestedAt).toLocaleDateString()}</TableCell>
                            <TableCell>{formatAmount(request.amount)}</TableCell>
                            <TableCell>{request.note || "—"}</TableCell>
                            <TableCell>
                              <Badge className={requestStatusClass(request.status)}>{request.status}</Badge>
                            </TableCell>
                            <TableCell>{request.adminNote || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

              <section className="space-y-4 rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white p-6 shadow-sm">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-neutral-900">Manual settlement fallback</h3>
                  <p className="text-sm text-neutral-600">Store bank or settlement instructions here in case you want to process organizer payouts manually.</p>
                </div>
                <div className="space-y-2">
                  <Label>Settlement Note</Label>
                  <Input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Bank details or internal payout instruction" />
                </div>
                <Button onClick={saveManual} disabled={isSavingManual}>{isSavingManual ? "Saving..." : "Save Manual Settings"}</Button>
              </section>
            </>
          )}
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
