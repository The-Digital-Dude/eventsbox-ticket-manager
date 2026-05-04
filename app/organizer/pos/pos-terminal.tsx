"use client";

import { useMemo, useState } from "react";
import { CreditCard, Gift, Landmark, Loader2, Mail, Printer, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";

type PosTicketType = {
  id: string;
  sectionId: string | null;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  reservedQty: number;
};

type PosSeat = {
  id: string;
  sectionId: string;
  seatLabel: string;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "BLOCKED";
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  price: number;
};

export type PosEvent = {
  id: string;
  title: string;
  mode: "SIMPLE" | "RESERVED_SEATING";
  startAt: string;
  venueName: string | null;
  ticketTypes: PosTicketType[];
  sections: Array<{
    id: string;
    name: string;
    color: string;
    rows: Array<{
      id: string;
      label: string;
      seats: PosSeat[];
    }>;
  }>;
};

type IssuedTicket = {
  id: string;
  ticketNumber: string;
  seatLabel: string | null;
  ticketTypeName: string;
  qrDataUrl: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function seatClassName(seat: PosSeat, selectedSeatId: string) {
  if (seat.id === selectedSeatId) return "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white";
  if (seat.status === "AVAILABLE") return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-500";
  if (seat.status === "RESERVED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (seat.status === "SOLD") return "border-neutral-300 bg-neutral-200 text-neutral-500";
  return "border-red-200 bg-red-50 text-red-700";
}

export function PosTerminal({ events }: { events: PosEvent[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedSeatId, setSelectedSeatId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD_EXTERNAL" | "COMPLIMENTARY">("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [issuedTickets, setIssuedTickets] = useState<IssuedTicket[]>([]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId) ?? events[0] ?? null,
    [eventId, events],
  );
  const selectedSeat = selectedEvent?.sections
    .flatMap((section) => section.rows.flatMap((row) => row.seats))
    .find((seat) => seat.id === selectedSeatId) ?? null;
  const selectedTicketTypeId = selectedEvent?.mode === "RESERVED_SEATING"
    ? selectedSeat?.ticketTypeId ?? ""
    : ticketTypeId;
  const selectedTicketType = selectedEvent?.ticketTypes.find((ticket) => ticket.id === selectedTicketTypeId) ?? null;
  const effectiveQuantity = selectedEvent?.mode === "RESERVED_SEATING" ? 1 : quantity;
  const subtotal = paymentMethod === "COMPLIMENTARY" ? 0 : (selectedTicketType?.price ?? 0) * effectiveQuantity;

  function handleEventChange(nextEventId: string) {
    setEventId(nextEventId);
    setTicketTypeId("");
    setSelectedSeatId("");
    setIssuedTickets([]);
    setQuantity(1);
  }

  async function issueTicket() {
    if (!selectedEvent) return toast.error("Select an event first");
    if (!selectedTicketTypeId) return toast.error("Select a ticket or available seat");
    if (!buyerName.trim() || !buyerEmail.trim()) return toast.error("Buyer name and email are required");

    setSaving(true);
    try {
      const res = await fetch("/api/organizer/pos/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          ticketTypeId: selectedTicketTypeId,
          quantity: effectiveQuantity,
          seatId: selectedEvent.mode === "RESERVED_SEATING" ? selectedSeatId : null,
          buyerName,
          buyerEmail,
          paymentMethod,
          note: note || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        return toast.error(payload.error?.message ?? "Unable to issue ticket");
      }

      setIssuedTickets(payload.data.tickets);
      toast.success("Ticket issued");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Point of Sale</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Issue paid or complimentary tickets for walk-up buyers.
            </p>
          </div>
          <Badge className="border-transparent bg-emerald-100 text-emerald-700">Terminal</Badge>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[var(--theme-accent)]">Step 1</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">Select Event</h2>
            <select
              value={selectedEvent?.id ?? ""}
              onChange={(event) => handleEventChange(event.target.value)}
              className="mt-4 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
            >
              {events.length === 0 ? <option>No published events</option> : null}
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} - {formatDate(event.startAt)}
                </option>
              ))}
            </select>
            {selectedEvent ? (
              <p className="mt-2 text-sm text-neutral-500">
                {selectedEvent.venueName ?? "Venue TBA"} - {selectedEvent.mode === "RESERVED_SEATING" ? "Reserved seating" : "Simple ticketing"}
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[var(--theme-accent)]">Step 2</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">Select Ticket / Seat</h2>

            {selectedEvent?.mode === "RESERVED_SEATING" ? (
              <div className="mt-4 space-y-5">
                {selectedEvent.sections.map((section) => (
                  <div key={section.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: section.color }} />
                      <h3 className="text-sm font-semibold text-neutral-900">{section.name}</h3>
                    </div>
                    {section.rows.map((row) => (
                      <div key={row.id} className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3">
                        <span className="text-xs font-medium text-neutral-500">{row.label}</span>
                        <div className="flex flex-wrap gap-2">
                          {row.seats.map((seat) => (
                            <button
                              key={seat.id}
                              type="button"
                              disabled={seat.status !== "AVAILABLE"}
                              onClick={() => setSelectedSeatId(seat.id)}
                              className={`h-10 min-w-12 rounded-lg border px-2 text-xs font-semibold transition disabled:cursor-not-allowed ${seatClassName(seat, selectedSeatId)}`}
                              title={seat.ticketTypeName ?? seat.status}
                            >
                              {seat.seatLabel}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                <select
                  value={ticketTypeId}
                  onChange={(event) => setTicketTypeId(event.target.value)}
                  className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
                >
                  <option value="">Choose ticket type</option>
                  {selectedEvent?.ticketTypes.map((ticket) => {
                    const available = Math.max(0, ticket.quantity - ticket.sold - ticket.reservedQty);
                    return (
                      <option key={ticket.id} value={ticket.id}>
                        {ticket.name} - {formatMoney(ticket.price)} ({available} left)
                      </option>
                    );
                  })}
                </select>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
                  className="h-11 rounded-xl border border-[var(--border)] px-3 text-sm"
                />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[var(--theme-accent)]">Step 3</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">Buyer Info</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-neutral-700">
                <span className="flex items-center gap-2"><User className="h-4 w-4" /> Name</span>
                <input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm" />
              </label>
              <label className="space-y-2 text-sm font-medium text-neutral-700">
                <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</span>
                <input type="email" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm" />
              </label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ["CASH", "Cash", Landmark],
                ["CARD_EXTERNAL", "Card", CreditCard],
                ["COMPLIMENTARY", "Complimentary", Gift],
              ].map(([value, label, Icon]) => (
                <button
                  key={value as string}
                  type="button"
                  onClick={() => setPaymentMethod(value as "CASH" | "CARD_EXTERNAL" | "COMPLIMENTARY")}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    paymentMethod === value
                      ? "border-[var(--theme-accent)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[var(--theme-accent)]"
                      : "border-[var(--border)] text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label as string}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note"
              className="mt-4 min-h-24 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[var(--theme-accent)]">Step 4</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">Issue Ticket</h2>
            <div className="mt-4 space-y-3 text-sm text-neutral-600">
              <div className="flex justify-between gap-3"><span>Ticket</span><strong className="text-neutral-900">{selectedTicketType?.name ?? "Not selected"}</strong></div>
              <div className="flex justify-between gap-3"><span>Seat</span><strong className="text-neutral-900">{selectedSeat?.seatLabel ?? "None"}</strong></div>
              <div className="flex justify-between gap-3"><span>Quantity</span><strong className="text-neutral-900">{effectiveQuantity}</strong></div>
              <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-3"><span>Total</span><strong className="text-neutral-900">{formatMoney(subtotal)}</strong></div>
            </div>
            <Button className="mt-5 w-full gap-2" onClick={() => void issueTicket()} disabled={saving || !selectedEvent}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Issue Ticket
            </Button>
          </section>

          {issuedTickets.length > 0 ? (
            <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-neutral-900">Issued QR</h2>
              <div className="mt-4 space-y-4">
                {issuedTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl border border-[var(--border)] p-4 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ticket.qrDataUrl} alt={`QR code for ${ticket.ticketNumber}`} className="mx-auto h-44 w-44" />
                    <p className="mt-2 font-mono text-xs text-neutral-600">{ticket.ticketNumber}</p>
                    {ticket.seatLabel ? <p className="mt-1 text-xs text-neutral-500">{ticket.seatLabel}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
