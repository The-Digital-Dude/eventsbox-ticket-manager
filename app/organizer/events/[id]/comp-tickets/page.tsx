"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type TicketTypeStats = {
  id: string;
  name: string;
  quantity: number;
  sold: number;
  reservedQty: number;
  compIssued: number;
  price: number | string;
  isActive: boolean;
};

type CompIssuanceRow = {
  id: string;
  recipientName: string;
  recipientEmail: string;
  note: string | null;
  createdAt: string;
  ticketType: {
    id: string;
    name: string;
  };
  qrTicket: {
    id: string;
    ticketNumber: string;
  };
};

type CompTicketsPayload = {
  event: {
    id: string;
    title: string;
    status: string;
    ticketTypes: TicketTypeStats[];
  };
  issuances: CompIssuanceRow[];
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default function OrganizerCompTicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<CompTicketsPayload | null>(null);
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [note, setNote] = useState("");

  const reservableTicketTypes = (data?.event.ticketTypes ?? []).filter((ticket) => ticket.reservedQty > 0);

  async function loadData() {
    setLoading(true);
    const response = await fetch(`/api/organizer/events/${id}/comp-tickets`);
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload?.error?.message ?? "Failed to load complimentary tickets");
      setLoading(false);
      return;
    }

    setData(payload.data);
    setTicketTypeId((current) => current || payload.data.event.ticketTypes.find((ticket: TicketTypeStats) => ticket.reservedQty > 0)?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function issueCompTicket() {
    if (!ticketTypeId) {
      toast.error("Choose a ticket type");
      return;
    }
    if (!recipientName.trim()) {
      toast.error("Recipient name is required");
      return;
    }
    if (!recipientEmail.trim()) {
      toast.error("Recipient email is required");
      return;
    }

    setSubmitting(true);
    const response = await fetch(`/api/organizer/events/${id}/comp-tickets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ticketTypeId,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim(),
        note: note.trim() || undefined,
      }),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      toast.error(payload?.error?.message ?? "Failed to issue complimentary ticket");
      return;
    }

    setRecipientName("");
    setRecipientEmail("");
    setNote("");
    toast.success("Complimentary ticket issued");
    await loadData();
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <div className="flex items-center gap-3">
        <Link
          href={`/organizer/events/${id}`}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <ChevronLeft className="h-4 w-4" /> Back to event
        </Link>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Comp Tickets</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {data?.event.title ?? "Loading event..."}
        </p>
      </section>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
      ) : !data ? null : reservableTicketTypes.length === 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">
            No complimentary slots are reserved yet. Go to Edit Event to reserve comp ticket slots first.
          </p>
          <Link
            href={`/organizer/events/${id}/edit`}
            className="mt-4 inline-flex text-sm font-medium text-[var(--theme-accent)] transition hover:underline"
          >
            Go to Edit Event
          </Link>
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.event.ticketTypes.map((ticket) => {
              const compRemaining = Math.max(0, ticket.reservedQty - ticket.compIssued);
              const publicAvailable = Math.max(0, ticket.quantity - ticket.sold - ticket.reservedQty);

              return (
                <div key={ticket.id} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-neutral-900">{ticket.name}</h2>
                    <Badge>{ticket.reservedQty} reserved</Badge>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-neutral-600">
                    <p>{ticket.compIssued} issued</p>
                    <p>{compRemaining} remaining comp slots</p>
                    <p>{publicAvailable} public tickets available</p>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Issue Comp Ticket</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ticketTypeId">Ticket Type</Label>
                <select
                  id="ticketTypeId"
                  className="app-select"
                  value={ticketTypeId}
                  onChange={(event) => setTicketTypeId(event.target.value)}
                >
                  {reservableTicketTypes.map((ticket) => (
                    <option key={ticket.id} value={ticket.id}>
                      {ticket.name} ({Math.max(0, ticket.reservedQty - ticket.compIssued)} remaining)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipientName">Recipient Name</Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipientEmail">Recipient Email</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional internal note"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={issueCompTicket} disabled={submitting}>
                {submitting ? "Issuing..." : "Issue Comp Ticket"}
              </Button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            <div className="border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-semibold text-neutral-900">Issued Tickets</h2>
            </div>
            {data.issuances.length === 0 ? (
              <div className="px-6 py-8 text-sm text-neutral-500">No complimentary tickets issued yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Ticket Type</th>
                    <th className="px-4 py-3">Issued At</th>
                    <th className="px-4 py-3">Ticket Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {data.issuances.map((issuance) => (
                    <tr key={issuance.id}>
                      <td className="px-4 py-3 font-medium text-neutral-900">{issuance.recipientName}</td>
                      <td className="px-4 py-3 text-neutral-600">{issuance.recipientEmail}</td>
                      <td className="px-4 py-3 text-neutral-600">{issuance.ticketType.name}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatDateTime(issuance.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-600">{issuance.qrTicket.ticketNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </SidebarLayout>
  );
}
