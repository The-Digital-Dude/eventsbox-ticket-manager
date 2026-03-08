"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { EmptyState } from "@/src/components/shared/empty-state";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type PayoutRequestRow = {
  id: string;
  amount: number | string | null;
  note: string | null;
  status: "PENDING" | "APPROVED" | "PAID" | "REJECTED";
  adminNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  organizerProfile: {
    id: string;
    companyName: string | null;
    brandName: string | null;
    user: { email: string };
  };
};

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

function statusBadgeClass(status: PayoutRequestRow["status"]) {
  if (status === "APPROVED") return "bg-blue-100 text-blue-700 border-transparent";
  if (status === "PAID") return "bg-emerald-100 text-emerald-700 border-transparent";
  if (status === "REJECTED") return "bg-red-100 text-red-700 border-transparent";
  return "bg-amber-100 text-amber-700 border-transparent";
}

function formatCurrency(amount: number | string | null) {
  if (amount === null || amount === undefined) return "Amount not specified";
  const normalized = Number(amount);
  if (!Number.isFinite(normalized)) return "Amount not specified";
  return `$${normalized.toFixed(2)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function AdminPayoutsPage() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<PayoutRequestRow[]>([]);
  const [allRows, setAllRows] = useState<PayoutRequestRow[]>([]);
  const [actionDraft, setActionDraft] = useState<{
    id: string | null;
    action: "APPROVED" | "PAID" | "REJECTED" | null;
    note: string;
  }>({ id: null, action: null, note: "" });

  const summary = useMemo(() => {
    const pending = allRows.filter((row) => row.status === "PENDING");
    const allPaid = allRows.filter((row) => row.status === "PAID");
    const totalPendingAmount = pending.reduce((sum, row) => {
      const value = Number(row.amount ?? 0);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);

    return {
      pendingCount: pending.length,
      pendingAmount: totalPendingAmount,
      paidCount: allPaid.length,
    };
  }, [allRows]);

  async function load(nextStatus: string = status, onRows: (nextRows: PayoutRequestRow[]) => void = setRows) {
    const filteredParams = new URLSearchParams();
    if (nextStatus) filteredParams.set("status", nextStatus);

    const [filteredRes, allRes] = await Promise.all([
      fetch(`/api/admin/payouts?${filteredParams.toString()}`),
      fetch("/api/admin/payouts"),
    ]);

    const [filteredPayload, allPayload] = await Promise.all([filteredRes.json(), allRes.json()]);

    if (!filteredRes.ok) {
      toast.error(filteredPayload?.error?.message ?? "Unable to load payout requests");
      return;
    }

    const filteredRows = (filteredPayload?.data ?? []) as PayoutRequestRow[];
    onRows(filteredRows);

    if (allRes.ok) {
      setAllRows((allPayload?.data ?? []) as PayoutRequestRow[]);
    }
  }

  useEffect(() => {
    let active = true;

    load(status, (nextRows) => {
      if (active) setRows(nextRows);
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function submitDecision() {
    if (!actionDraft.id || !actionDraft.action) return;

    const res = await fetch(`/api/admin/payouts/${actionDraft.id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: actionDraft.action,
        adminNote: actionDraft.note.trim() || undefined,
      }),
    });
    const payload = await res.json();

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to apply decision");
      return;
    }

    toast.success("Payout request updated");
    setActionDraft({ id: null, action: null, note: "" });
    await load();
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Payout Requests" subtitle="Review and action organizer manual payout requests." />

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Pending Requests</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900">{summary.pendingCount}</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Total Pending Amount</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900">${summary.pendingAmount.toFixed(2)}</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">All Time Paid</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900">{summary.paidCount}</p>
        </article>
      </section>

      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <select className="app-select" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="PAID">PAID</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No payout requests match the current filter." subtitle="Try another status to see payout requests." />
      ) : (
        <section className="grid gap-3">
          {rows.map((request) => {
            const organizerName = request.organizerProfile.companyName || request.organizerProfile.brandName || "Unspecified Organizer";
            const isActionOpen = actionDraft.id === request.id;
            const isPending = request.status === "PENDING";
            const isApproved = request.status === "APPROVED";

            return (
              <article key={request.id} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{request.organizerProfile.user.email}</p>
                    <p className="text-sm text-neutral-600">{organizerName}</p>
                    <p className="text-xs text-neutral-500">Requested: {formatDateTime(request.requestedAt)}</p>
                  </div>
                  <Badge className={statusBadgeClass(request.status)}>{request.status}</Badge>
                </div>

                <p className="mt-3 text-lg font-semibold text-neutral-900">{formatCurrency(request.amount)}</p>

                {request.note ? (
                  <div className="mt-2 rounded-xl border border-[var(--border)] bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                    Organizer note: {request.note}
                  </div>
                ) : null}

                {request.adminNote ? (
                  <div className={`mt-2 rounded-xl border px-4 py-3 text-sm ${request.status === "REJECTED" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
                    Admin note: {request.adminNote}
                  </div>
                ) : null}

                {isPending || isApproved ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isPending ? (
                      <Button size="sm" onClick={() => setActionDraft({ id: request.id, action: "APPROVED", note: request.adminNote ?? "" })}>Approve</Button>
                    ) : null}
                    {isApproved ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => setActionDraft({ id: request.id, action: "PAID", note: request.adminNote ?? "" })}
                      >
                        Mark as Paid
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => setActionDraft({ id: request.id, action: "REJECTED", note: request.adminNote ?? "" })}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-neutral-600">Resolved: {formatDateTime(request.resolvedAt)}</p>
                )}

                {isActionOpen ? (
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
                    <p className="mb-2 text-sm font-medium text-neutral-800">{actionDraft.action === "PAID" ? "Mark as paid" : actionDraft.action === "REJECTED" ? "Reject request" : "Approve request"}</p>
                    <Input
                      value={actionDraft.note}
                      onChange={(event) => setActionDraft((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder="Add admin note (optional)"
                    />
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={submitDecision}>Confirm</Button>
                      <Button size="sm" variant="ghost" onClick={() => setActionDraft({ id: null, action: null, note: "" })}>Cancel</Button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </SidebarLayout>
  );
}
