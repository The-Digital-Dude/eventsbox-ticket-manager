"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, CalendarDays, MapPin, Download } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";
import QRCode from "qrcode";

type QRTicket = {
  id: string;
  token: string;
  ticketNumber: string;
  seatLabel?: string | null;
  checkedInAt: string | null;
};

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  ticketType: { id: string; name: string; kind: string };
  tickets: QRTicket[];
};

type Order = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  status: string;
  subtotal: number | string;
  platformFee: number | string;
  gst: number | string;
  total: number | string;
  paidAt: string | null;
  createdAt: string;
  event: {
    id: string;
    title: string;
    slug: string;
    startAt: string;
    endAt: string;
    timezone: string;
    venue: { name: string; addressLine1: string } | null;
  };
  items: OrderItem[];
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function QRDisplay({ token }: { token: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(token, { width: 200, margin: 2 }).then(setDataUrl).catch(() => {});
  }, [token]);

  if (!dataUrl) return <div className="h-[200px] w-[200px] animate-pulse rounded-xl bg-neutral-100" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="QR code" className="rounded-xl border border-[var(--border)]" width={200} height={200} />;
}

export default function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const isPending = searchParams.get("pending") === "1";
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [polling, setPolling] = useState(isPending);

  async function loadOrder() {
    const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const payload = await res.json();
    setOrder(payload.data);
    setLoading(false);
    if (payload.data?.status === "PAID") setPolling(false);
  }

  useEffect(() => {
    loadOrder(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every 3 seconds while payment is pending
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(loadOrder, 3000);
    const timeout = setTimeout(() => { setPolling(false); clearInterval(interval); }, 60000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [polling]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg,#f8f8f8)]">
        <div className="space-y-4 text-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-[var(--theme-accent)] border-t-transparent mx-auto" />
          <p className="text-neutral-600">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--page-bg,#f8f8f8)] text-center">
        <h1 className="text-3xl font-bold text-neutral-900">Order Not Found</h1>
        <Link href="/events" className="mt-4 text-[var(--theme-accent)] underline">Browse Events</Link>
      </div>
    );
  }

  const isPaid = order.status === "PAID";
  const allTickets = order.items.flatMap((item) => item.tickets.map((t) => ({ ...t, ticketType: item.ticketType })));

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
      <div className="h-2 bg-gradient-to-r from-[var(--theme-accent)] to-[rgb(59,130,246)]" />

      <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        {/* Status banner */}
        <div className={`rounded-2xl border p-6 text-center ${isPaid ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          {isPaid ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h1 className="mt-3 text-2xl font-bold text-emerald-900">Booking Confirmed!</h1>
              <p className="mt-1 text-emerald-700">Your tickets are ready below. Keep this page for entry.</p>
            </>
          ) : (
            <>
              <Clock3 className="mx-auto h-12 w-12 text-amber-500 animate-pulse" />
              <h1 className="mt-3 text-2xl font-bold text-amber-900">Payment Processing...</h1>
              <p className="mt-1 text-amber-700">This page will update automatically once your payment is confirmed.</p>
            </>
          )}
        </div>

        {/* Event info */}
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">{order.event.title}</h2>
          <div className="space-y-2 text-sm text-neutral-600">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" />
              {formatDateTime(order.event.startAt)}
            </div>
            {order.event.venue && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--theme-accent)]" />
                {order.event.venue.name} · {order.event.venue.addressLine1}
              </div>
            )}
          </div>
        </section>

        {/* Order summary */}
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm text-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Order Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-neutral-600"><span>Order ID</span><span className="font-mono text-xs">{order.id}</span></div>
            <div className="flex justify-between text-neutral-600"><span>Buyer</span><span>{order.buyerName}</span></div>
            <div className="flex justify-between text-neutral-600"><span>Email</span><span>{order.buyerEmail}</span></div>
            <div className="flex justify-between text-neutral-600"><span>Status</span><Badge className={isPaid ? "bg-emerald-100 text-emerald-700 border-transparent" : "bg-amber-100 text-amber-700 border-transparent"}>{order.status}</Badge></div>
            {order.paidAt && <div className="flex justify-between text-neutral-600"><span>Paid at</span><span>{formatDateTime(order.paidAt)}</span></div>}
          </div>
          <div className="my-4 border-t border-[var(--border)]" />
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-1 text-neutral-700">
              <span>{item.ticketType.name} × {item.quantity}</span>
              <span>${Number(item.subtotal).toFixed(2)}</span>
            </div>
          ))}
          <div className="my-2 border-t border-[var(--border)]" />
          <div className="flex justify-between text-neutral-600"><span>Subtotal</span><span>${Number(order.subtotal).toFixed(2)}</span></div>
          <div className="flex justify-between text-neutral-600"><span>Platform fee</span><span>${Number(order.platformFee).toFixed(2)}</span></div>
          <div className="flex justify-between text-neutral-600"><span>GST</span><span>${Number(order.gst).toFixed(2)}</span></div>
          <div className="my-2 border-t border-[var(--border)]" />
          <div className="flex justify-between text-base font-bold text-neutral-900"><span>Total</span><span>${Number(order.total).toFixed(2)}</span></div>
        </section>

        {/* QR Tickets */}
        {isPaid && allTickets.length > 0 && (
          <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">Your Tickets</h2>
              <p className="text-sm text-neutral-500">{allTickets.length} ticket{allTickets.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {allTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-col items-center gap-4 rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.2)] bg-[rgb(var(--theme-accent-rgb)/0.04)] p-5 text-center"
                >
                  <QRDisplay token={ticket.token} />
                  <div>
                    <p className="font-semibold text-neutral-900">{ticket.ticketType.name}</p>
                    <p className="mt-1 font-mono text-xs text-neutral-500">{ticket.ticketNumber}</p>
                    {ticket.seatLabel ? <p className="mt-1 text-xs text-neutral-600">{ticket.seatLabel}</p> : null}
                    {ticket.checkedInAt ? (
                      <Badge className="mt-2 bg-emerald-100 text-emerald-700 border-transparent">
                        Checked in {formatDateTime(ticket.checkedInAt)}
                      </Badge>
                    ) : (
                      <Badge className="mt-2 bg-neutral-100 text-neutral-600 border-transparent">Not checked in</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = `/api/orders/${order.id}`;
                      link.download = `ticket-${ticket.ticketNumber}.json`;
                      link.click();
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="text-center">
          <Link href="/events" className="text-sm text-[var(--theme-accent)] underline underline-offset-4">
            Browse more events
          </Link>
        </div>
      </div>
    </div>
  );
}
