"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type PromoCodeRow = {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number | string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  eventId: string | null;
};

type OrganizerEvent = {
  id: string;
  title: string;
  status: string;
};

type PromoCodeForm = {
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  maxUses: string;
  expiresAt: string;
  eventId: string;
  isActive: boolean;
};

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

const initialForm: PromoCodeForm = {
  code: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  maxUses: "",
  expiresAt: "",
  eventId: "",
  isActive: true,
};

function formatValue(type: PromoCodeRow["discountType"], value: number | string) {
  const numeric = Number(value);
  if (type === "PERCENTAGE") return `${numeric}%`;
  return `$${numeric.toFixed(2)}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export default function OrganizerPromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCodeRow[]>([]);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<PromoCodeForm>(initialForm);

  async function loadData() {
    setLoading(true);
    try {
      const [codesRes, eventsRes] = await Promise.all([
        fetch("/api/organizer/promo-codes"),
        fetch("/api/organizer/events"),
      ]);

      const [codesPayload, eventsPayload] = await Promise.all([codesRes.json(), eventsRes.json()]);
      if (!codesRes.ok) {
        toast.error(codesPayload?.error?.message ?? "Failed to load promo codes");
      } else {
        setPromoCodes(codesPayload?.data ?? []);
      }

      if (!eventsRes.ok) {
        toast.error(eventsPayload?.error?.message ?? "Failed to load events");
      } else {
        setEvents(eventsPayload?.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function createPromoCode() {
    if (!form.code.trim()) {
      toast.error("Code is required");
      return;
    }
    if (!form.discountValue) {
      toast.error("Discount value is required");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/organizer/promo-codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        eventId: form.eventId || undefined,
        isActive: form.isActive,
      }),
    });
    const payload = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Failed to create promo code");
      return;
    }

    setPromoCodes((prev) => [payload.data, ...prev]);
    setForm(initialForm);
    toast.success("Promo code created");
  }

  async function toggleActive(code: PromoCodeRow) {
    const res = await fetch(`/api/organizer/promo-codes/${code.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !code.isActive }),
    });
    const payload = await res.json();
    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Failed to update promo code");
      return;
    }

    setPromoCodes((prev) => prev.map((row) => (row.id === code.id ? payload.data : row)));
  }

  async function deactivate(code: PromoCodeRow) {
    const res = await fetch(`/api/organizer/promo-codes/${code.id}`, { method: "DELETE" });
    const payload = await res.json();
    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Failed to deactivate promo code");
      return;
    }

    setPromoCodes((prev) => prev.map((row) => (row.id === code.id ? { ...row, isActive: false } : row)));
    toast.success("Promo code deactivated");
  }

  const eventOptions = events.filter((event) => event.status === "PUBLISHED");

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Promo Codes</h1>
        <p className="mt-2 text-sm text-neutral-600">Create and manage discount codes for your events.</p>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Create Promo Code</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
              placeholder="SAVE10"
              maxLength={20}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discountType">Type</Label>
            <select
              id="discountType"
              className="app-select"
              value={form.discountType}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  discountType: event.target.value as PromoCodeForm["discountType"],
                }))
              }
            >
              <option value="PERCENTAGE">PERCENTAGE</option>
              <option value="FIXED">FIXED</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="discountValue">Value</Label>
            <Input
              id="discountValue"
              type="number"
              min="0"
              step="0.01"
              value={form.discountValue}
              onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))}
              placeholder={form.discountType === "PERCENTAGE" ? "10" : "5.00"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxUses">Max Uses</Label>
            <Input
              id="maxUses"
              type="number"
              min="1"
              value={form.maxUses}
              onChange={(event) => setForm((prev) => ({ ...prev, maxUses: event.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiresAt">Expires At</Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventId">Event (Optional)</Label>
            <select
              id="eventId"
              className="app-select"
              value={form.eventId}
              onChange={(event) => setForm((prev) => ({ ...prev, eventId: event.target.value }))}
            >
              <option value="">All events</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <Button onClick={createPromoCode} disabled={submitting}>
            {submitting ? "Creating..." : "Create Promo Code"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">Existing Promo Codes</h2>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-sm text-neutral-500">Loading promo codes...</div>
        ) : promoCodes.length === 0 ? (
          <div className="px-6 py-8 text-sm text-neutral-500">No promo codes yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Deactivate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {promoCodes.map((code) => (
                <tr key={code.id}>
                  <td className="px-4 py-3 font-medium text-neutral-900">{code.code}</td>
                  <td className="px-4 py-3 text-neutral-600">{code.discountType}</td>
                  <td className="px-4 py-3 text-neutral-600">{formatValue(code.discountType, code.discountValue)}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {code.usedCount}/{code.maxUses ?? "∞"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{formatDateTime(code.expiresAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(code)}
                      className="inline-flex items-center gap-2"
                    >
                      <span
                        className={`h-5 w-10 rounded-full transition ${
                          code.isActive ? "bg-emerald-500" : "bg-neutral-300"
                        }`}
                      >
                        <span
                          className={`mt-0.5 block h-4 w-4 rounded-full bg-white transition ${
                            code.isActive ? "ml-5" : "ml-0.5"
                          }`}
                        />
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {code.isActive ? (
                      <Button size="sm" variant="outline" onClick={() => deactivate(code)}>
                        Deactivate
                      </Button>
                    ) : (
                      <Badge className="bg-neutral-100 text-neutral-600">Deactivated</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </SidebarLayout>
  );
}
