"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Building2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  price: number | string;
  quantity: number;
  sold: number;
  maxPerOrder: number;
  saleStartAt: string | null;
  saleEndAt: string | null;
};

type EventDetail = {
  id: string;
  title: string;
  slug: string;
  heroImage: string | null;
  description: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  cancelPolicy: string | null;
  refundPolicy: string | null;
  gstPct: number | string;
  commissionPct: number | string;
  platformFeeFixed: number | string;
  category: { name: string } | null;
  venue: { name: string; addressLine1: string } | null;
  state: { name: string } | null;
  city: { name: string } | null;
  ticketTypes: TicketType[];
  organizerProfile: { companyName: string | null; brandName: string | null; website: string | null; supportEmail: string | null };
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Cart state: ticketTypeId → quantity
  const [cart, setCart] = useState<Record<string, number>>({});

  // Buyer info
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    fetch(`/api/public/events/${slug}`)
      .then((r) => r.json())
      .then((payload) => {
        if (!payload?.data) { setNotFound(true); setLoading(false); return; }
        setEvent(payload.data);
        setLoading(false);
      });
  }, [slug]);

  function setQty(ticketTypeId: string, qty: number) {
    setCart((prev) => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[ticketTypeId];
        return next;
      }
      return { ...prev, [ticketTypeId]: qty };
    });
  }

  const cartItems = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartTotal = cartItems.reduce((sum, [ttId, qty]) => {
    const tt = event?.ticketTypes.find((t) => t.id === ttId);
    return sum + (Number(tt?.price ?? 0) * qty);
  }, 0);

  const commissionPct = Number(event?.commissionPct ?? 10);
  const gstPct = Number(event?.gstPct ?? 15);
  const platformFeeFixed = Number(event?.platformFeeFixed ?? 0);
  const platformFee = parseFloat((cartTotal * (commissionPct / 100) + platformFeeFixed).toFixed(2));
  const gst = parseFloat(((cartTotal + platformFee) * (gstPct / 100)).toFixed(2));
  const grandTotal = parseFloat((cartTotal + platformFee + gst).toFixed(2));

  async function checkout() {
    if (cartItems.length === 0) return toast.error("Select at least one ticket");
    if (!buyerName.trim()) return toast.error("Enter your name");
    if (!buyerEmail.trim()) return toast.error("Enter your email");

    setCheckingOut(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event!.id,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        items: cartItems.map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
      }),
    });
    const payload = await res.json();
    setCheckingOut(false);

    if (!res.ok) return toast.error(payload?.error?.message ?? "Checkout failed");

    // Redirect to Stripe Elements checkout page to confirm payment
    const { orderId, clientSecret } = payload.data;
    router.push(`/checkout/${orderId}?cs=${encodeURIComponent(clientSecret)}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
        <div className="mx-auto max-w-4xl px-4 py-10 space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-neutral-100" />)}
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--page-bg,#f8f8f8)] text-center">
        <h1 className="text-3xl font-bold text-neutral-900">Event Not Found</h1>
        <p className="mt-2 text-neutral-600">This event may have ended or been removed.</p>
        <Button className="mt-6" onClick={() => router.push("/events")}>Browse Events</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
      {/* Hero bar */}
      <div className="h-2 bg-gradient-to-r from-[var(--theme-accent)] to-[rgb(59,130,246)]" />

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">

          {/* Left: Event info */}
          <div className="space-y-6">
            {event.heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.heroImage}
                alt={event.title}
                className="h-72 w-full rounded-2xl border border-[var(--border)] object-cover shadow-sm"
              />
            )}
            <div>
              {event.category && <Badge className="mb-3">{event.category.name}</Badge>}
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{event.title}</h1>

              <div className="mt-4 space-y-2 text-sm text-neutral-600">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" />
                  {formatDateTime(event.startAt)} — {formatDateTime(event.endAt)}
                </div>
                {event.venue && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[var(--theme-accent)]" />
                    {event.venue.name} · {event.venue.addressLine1}
                  </div>
                )}
                {(event.state || event.city) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[var(--theme-accent)]" />
                    {[event.city?.name, event.state?.name].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            </div>

            {event.description && (
              <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-neutral-900">About this event</h2>
                <p className="whitespace-pre-wrap text-sm text-neutral-700 leading-relaxed">{event.description}</p>
              </section>
            )}

            {(event.cancelPolicy || event.refundPolicy) && (
              <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-neutral-900">Policies</h2>
                {event.cancelPolicy && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-neutral-700">Cancellation</p>
                    <p className="mt-1 text-sm text-neutral-600">{event.cancelPolicy}</p>
                  </div>
                )}
                {event.refundPolicy && (
                  <div>
                    <p className="text-sm font-medium text-neutral-700">Refunds</p>
                    <p className="mt-1 text-sm text-neutral-600">{event.refundPolicy}</p>
                  </div>
                )}
              </section>
            )}

            {/* Organizer */}
            <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">Organiser</h2>
              <p className="font-medium text-neutral-900">{event.organizerProfile.brandName ?? event.organizerProfile.companyName ?? "Event Organiser"}</p>
              <div className="mt-2 space-y-1 text-sm text-neutral-600">
                {event.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> {event.contactEmail}
                  </div>
                )}
                {event.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> {event.contactPhone}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right: Ticket selector + checkout */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.3)] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-neutral-900">Select Tickets</h2>

              {event.ticketTypes.length === 0 ? (
                <p className="text-sm text-neutral-500">No tickets available at this time.</p>
              ) : (
                <div className="space-y-3">
                  {event.ticketTypes.map((tt) => {
                    const available = tt.quantity - tt.sold;
                    const isSoldOut = available <= 0;
                    const qty = cart[tt.id] ?? 0;

                    return (
                      <div key={tt.id} className={`rounded-xl border p-4 ${isSoldOut ? "border-neutral-200 bg-neutral-50 opacity-60" : "border-[var(--border)]"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-neutral-900">{tt.name}</p>
                            {tt.description && <p className="mt-0.5 text-xs text-neutral-500">{tt.description}</p>}
                            {isSoldOut
                              ? <Badge className="mt-1 bg-red-100 text-red-700 border-transparent text-xs">Sold out</Badge>
                              : available <= 10
                                ? <Badge className="mt-1 bg-amber-100 text-amber-700 border-transparent text-xs">Only {available} left</Badge>
                                : null
                            }
                          </div>
                          <p className="shrink-0 text-lg font-bold text-neutral-900">${Number(tt.price).toFixed(2)}</p>
                        </div>

                        {!isSoldOut && (
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={() => setQty(tt.id, Math.max(0, qty - 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-neutral-700 hover:bg-neutral-100 transition"
                            >−</button>
                            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                            <button
                              onClick={() => setQty(tt.id, Math.min(tt.maxPerOrder, available, qty + 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-neutral-700 hover:bg-neutral-100 transition"
                            >+</button>
                            <span className="text-xs text-neutral-400">Max {tt.maxPerOrder} per order</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Fee breakdown */}
            {cartItems.length > 0 && (
              <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm text-sm">
                <h3 className="mb-3 font-semibold text-neutral-900">Order Summary</h3>
                {cartItems.map(([ttId, qty]) => {
                  const tt = event.ticketTypes.find((t) => t.id === ttId);
                  if (!tt) return null;
                  return (
                    <div key={ttId} className="flex justify-between py-1 text-neutral-700">
                      <span>{tt.name} × {qty}</span>
                      <span>${(Number(tt.price) * qty).toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="my-2 border-t border-[var(--border)]" />
                <div className="flex justify-between text-neutral-600"><span>Subtotal</span><span>${cartTotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-neutral-600"><span>Platform fee ({commissionPct}%{platformFeeFixed > 0 ? ` + $${platformFeeFixed.toFixed(2)}` : ""})</span><span>${platformFee.toFixed(2)}</span></div>
                <div className="flex justify-between text-neutral-600"><span>GST ({gstPct}%)</span><span>${gst.toFixed(2)}</span></div>
                <div className="my-2 border-t border-[var(--border)]" />
                <div className="flex justify-between text-base font-semibold text-neutral-900"><span>Total</span><span>${grandTotal.toFixed(2)}</span></div>
              </section>
            )}

            {/* Buyer details + CTA */}
            {cartItems.length > 0 && (
              <section className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.3)] bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-neutral-900">Your Details</h3>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="jane@example.com" />
                </div>
                <Button className="w-full" onClick={checkout} disabled={checkingOut}>
                  {checkingOut ? "Processing..." : `Pay $${grandTotal.toFixed(2)}`}
                </Button>
                <p className="text-center text-xs text-neutral-400">Secured by Stripe</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
