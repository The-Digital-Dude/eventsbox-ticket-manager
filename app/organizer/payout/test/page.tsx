"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRightLeft, CreditCard, Landmark, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type TestPaymentState = {
  stripeConfigured: boolean;
  defaultCommissionPct: number;
  payoutSettings: {
    payoutMode: "MANUAL" | "STRIPE_CONNECT" | null;
    stripeAccountId: string | null;
    stripeOnboardingStatus: "NOT_STARTED" | "PENDING" | "COMPLETED" | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    requirementsDisabledReason: string | null;
  };
  session: {
    id: string;
    status: string | null;
    paymentStatus: string | null;
    currency: string | null;
    grossAmount: number;
    applicationFeeAmount: number | null;
    organizerNetAmount: number | null;
    connectedAccountId: string | null;
    paymentIntentId: string | null;
  } | null;
};

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
  { href: "/organizer/affiliate", label: "Affiliate Links" },
  { href: "/organizer/cancellation-requests", label: "Cancellations" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

function formatMoney(amount: number | null | undefined, currency = "usd") {
  if (amount === null || amount === undefined) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default function OrganizerPayoutTestPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? searchParams.get("sessionId");
  const canceled = searchParams.get("canceled");
  const [data, setData] = useState<TestPaymentState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [amount, setAmount] = useState("25");
  const [platformFeePct, setPlatformFeePct] = useState("");
  const [description, setDescription] = useState("EventsBox sandbox ticket");

  useEffect(() => {
    async function loadState() {
      setIsLoading(true);
      try {
        const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
        const res = await fetch(`/api/organizer/payout/test-payment${qs}`);
        const payload = await res.json();
        if (!res.ok) {
          toast.error(payload?.error?.message ?? "Unable to load payment test state");
          return;
        }

        setData(payload.data);
        setPlatformFeePct((current) => current || String(payload.data.defaultCommissionPct || ""));
      } finally {
        setIsLoading(false);
      }
    }

    loadState();
  }, [sessionId]);

  useEffect(() => {
    if (canceled) {
      toast.error("Stripe Checkout was canceled");
    }
  }, [canceled]);

  async function startCheckout() {
    setIsStartingCheckout(true);
    try {
      const res = await fetch("/api/organizer/payout/test-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          description,
          platformFeePct: platformFeePct ? Number(platformFeePct) : undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error?.message ?? "Unable to start Stripe Checkout");
        return;
      }

      window.location.href = payload.data.url;
    } finally {
      setIsStartingCheckout(false);
    }
  }

  const payoutSettings = data?.payoutSettings;
  const session = data?.session;
  const accountReady = Boolean(payoutSettings?.stripeAccountId && payoutSettings.chargesEnabled);

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader
        title="Test Split Payment"
        subtitle="Run a sandbox Checkout payment and verify the platform fee plus organizer transfer."
      />

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Checkout Sandbox</CardTitle>
            <CardDescription>
              This creates a Stripe Checkout session on the platform and routes the organizer share to the connected account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Ticket Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platformFee">Platform Fee %</Label>
                <Input
                  id="platformFee"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={platformFeePct}
                  onChange={(event) => setPlatformFeePct(event.target.value)}
                  placeholder="Uses platform default"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Line Item Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="EventsBox sandbox ticket"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={startCheckout} disabled={isStartingCheckout || isLoading || !accountReady}>
                {isStartingCheckout ? "Redirecting..." : "Open Stripe Checkout"}
              </Button>
              <Link
                href="/organizer/payout"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-[rgb(var(--theme-accent-rgb)/0.05)]"
              >
                Back to Payout
              </Link>
            </div>
            {!accountReady ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Finish Stripe onboarding until charges are enabled, then come back here to test the split payment flow.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stripe Readiness</CardTitle>
            <CardDescription>Quick check of the connected account that will receive the organizer share.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className={payoutSettings?.chargesEnabled ? "border-transparent bg-emerald-100 text-emerald-700" : ""}>
                {payoutSettings?.chargesEnabled ? "Charges enabled" : "Charges not enabled"}
              </Badge>
              <Badge className={payoutSettings?.payoutsEnabled ? "border-transparent bg-emerald-100 text-emerald-700" : ""}>
                {payoutSettings?.payoutsEnabled ? "Payouts enabled" : "Payouts pending"}
              </Badge>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">Connected account</p>
              <p className="mt-1 break-all">{payoutSettings?.stripeAccountId ?? "No connected account yet"}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">Platform default fee</p>
              <p className="mt-1">{data ? `${data.defaultCommissionPct}%` : "Loading..."}</p>
            </div>
            {payoutSettings?.requirementsDisabledReason ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Stripe requirement
                </div>
                <p className="mt-1">{payoutSettings.requirementsDisabledReason}</p>
              </div>
            ) : null}
            <div className="rounded-2xl border border-[var(--border)] bg-[rgb(var(--theme-accent-rgb)/0.05)] p-4 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">Use Stripe test card</p>
              <p className="mt-1">`4242 4242 4242 4242` with any future expiry, any CVC, and any ZIP code.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {session ? (
        <section className="grid gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Gross Payment</CardDescription>
              <CardTitle className="text-2xl">{formatMoney(session.grossAmount, session.currency ?? "usd")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-neutral-600">
              Total amount collected through Checkout.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Platform Fee</CardDescription>
              <CardTitle className="text-2xl">{formatMoney(session.applicationFeeAmount, session.currency ?? "usd")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-neutral-600">
              Application fee retained by the platform.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Organizer Share</CardDescription>
              <CardTitle className="text-2xl">{formatMoney(session.organizerNetAmount, session.currency ?? "usd")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-neutral-600">
              Amount sent to the connected organizer account.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Payment Status</CardDescription>
              <CardTitle className="text-2xl capitalize">{session.paymentStatus ?? "unknown"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-neutral-600">
              Checkout session `{session.id}`.
            </CardContent>
          </Card>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Latest Test Result</CardTitle>
          <CardDescription>
            After Stripe sends you back here, this section shows the last Checkout session and split breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="mb-2 flex items-center gap-2 font-medium text-neutral-900">
              <ReceiptText className="h-4 w-4 text-[var(--theme-accent)]" />
              Session
            </div>
            <p className="break-all">{session?.id ?? "Run a test payment to populate this"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="mb-2 flex items-center gap-2 font-medium text-neutral-900">
              <CreditCard className="h-4 w-4 text-[var(--theme-accent)]" />
              Payment Intent
            </div>
            <p className="break-all">{session?.paymentIntentId ?? "Not available yet"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="mb-2 flex items-center gap-2 font-medium text-neutral-900">
              <Landmark className="h-4 w-4 text-[var(--theme-accent)]" />
              Destination Account
            </div>
            <p className="break-all">{session?.connectedAccountId ?? payoutSettings?.stripeAccountId ?? "Not available yet"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="mb-2 flex items-center gap-2 font-medium text-neutral-900">
              <ArrowRightLeft className="h-4 w-4 text-[var(--theme-accent)]" />
              Session Status
            </div>
            <p className="capitalize">{session?.status ?? "open a test checkout first"}</p>
          </div>
        </CardContent>
      </Card>
    </SidebarLayout>
  );
}
