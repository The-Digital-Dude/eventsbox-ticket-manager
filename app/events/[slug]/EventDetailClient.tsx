"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, Mail, MapPin, Phone, Share2 } from "lucide-react";
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
  organizerProfile: {
    companyName: string | null;
    brandName: string | null;
    website: string | null;
    supportEmail: string | null;
  };
};

type AppliedPromo = {
  promoCodeId: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventDetailClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [waitlistOpenTicketId, setWaitlistOpenTicketId] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistSubmittingFor, setWaitlistSubmittingFor] = useState<string | null>(null);
  const [waitlistMessageByTicket, setWaitlistMessageByTicket] = useState<Record<string, string>>({});
  const [waitlistErrorByTicket, setWaitlistErrorByTicket] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/public/events/${slug}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!payload?.data) {
          setNotFound(true);
          setLoading(false);
          return;
        }

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
  const cartTotal = cartItems.reduce((sum, [ticketTypeId, qty]) => {
    const ticketType = event?.ticketTypes.find((item) => item.id === ticketTypeId);
    return sum + Number(ticketType?.price ?? 0) * qty;
  }, 0);

  const discountAmount = appliedPromo
    ? parseFloat(
        (
          appliedPromo.discountType === "PERCENTAGE"
            ? cartTotal * (appliedPromo.discountValue / 100)
            : Math.min(appliedPromo.discountValue, cartTotal)
        ).toFixed(2),
      )
    : 0;
  const discountedSubtotal = parseFloat(Math.max(0, cartTotal - discountAmount).toFixed(2));

  const commissionPct = Number(event?.commissionPct ?? 10);
  const gstPct = Number(event?.gstPct ?? 15);
  const platformFeeFixed = Number(event?.platformFeeFixed ?? 0);
  const platformFee = parseFloat(
    (discountedSubtotal * (commissionPct / 100) + platformFeeFixed).toFixed(2),
  );
  const gst = parseFloat(((discountedSubtotal + platformFee) * (gstPct / 100)).toFixed(2));
  const grandTotal = parseFloat((discountedSubtotal + platformFee + gst).toFixed(2));

  async function applyPromo() {
    if (!event) return;
    if (!promoCode.trim()) {
      setPromoError("Enter a promo code");
      setPromoSuccess("");
      setAppliedPromo(null);
      return;
    }

    setApplyingPromo(true);
    setPromoError("");
    setPromoSuccess("");

    const res = await fetch("/api/checkout/validate-promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: promoCode.trim(), eventId: event.id }),
    });
    const payload = await res.json();
    setApplyingPromo(false);

    if (!res.ok) {
      setPromoError(payload?.error?.message ?? "Unable to validate promo code");
      setAppliedPromo(null);
      return;
    }

    if (!payload?.data?.valid) {
      setPromoError(payload?.data?.message ?? "Promo code is invalid");
      setAppliedPromo(null);
      return;
    }

    const promoData = payload.data as {
      valid: true;
      promoCodeId: string;
      discountType: "PERCENTAGE" | "FIXED";
      discountValue: number | string;
    };

    setAppliedPromo({
      promoCodeId: promoData.promoCodeId,
      discountType: promoData.discountType,
      discountValue: Number(promoData.discountValue),
    });
    setPromoSuccess(
      `Promo applied: ${
        promoData.discountType === "PERCENTAGE"
          ? `${promoData.discountValue}%`
          : `$${Number(promoData.discountValue).toFixed(2)}`
      } off`,
    );
    setPromoError("");
  }

  async function joinWaitlist(ticketTypeId: string) {
    if (!waitlistEmail.trim()) {
      setWaitlistErrorByTicket((prev) => ({ ...prev, [ticketTypeId]: "Email is required" }));
      return;
    }

    setWaitlistSubmittingFor(ticketTypeId);
    setWaitlistErrorByTicket((prev) => ({ ...prev, [ticketTypeId]: "" }));

    const res = await fetch(`/api/events/${slug}/waitlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: waitlistEmail.trim(),
        name: waitlistName.trim() || undefined,
        ticketTypeId,
      }),
    });
    const payload = await res.json();
    setWaitlistSubmittingFor(null);

    if (!res.ok) {
      setWaitlistErrorByTicket((prev) => ({
        ...prev,
        [ticketTypeId]: payload?.error?.message ?? "Unable to join waitlist",
      }));
      return;
    }

    if (payload?.data?.alreadyJoined) {
      setWaitlistMessageByTicket((prev) => ({
        ...prev,
        [ticketTypeId]: "You're already on the waitlist.",
      }));
    } else {
      setWaitlistMessageByTicket((prev) => ({ ...prev, [ticketTypeId]: "You're on the waitlist!" }));
    }

    setWaitlistOpenTicketId(null);
    setWaitlistName("");
    setWaitlistErrorByTicket((prev) => ({ ...prev, [ticketTypeId]: "" }));
  }

  async function checkout() {
    if (!event) return;
    if (cartItems.length === 0) return toast.error("Select at least one ticket");
    if (!buyerName.trim()) return toast.error("Enter your name");
    if (!buyerEmail.trim()) return toast.error("Enter your email");

    setCheckingOut(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.id,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        items: cartItems.map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
        ...(appliedPromo ? { promoCodeId: appliedPromo.promoCodeId } : {}),
      }),
    });
    const payload = await res.json();
    setCheckingOut(false);

    if (!res.ok) return toast.error(payload?.error?.message ?? "Checkout failed");

    const { orderId, clientSecret } = payload.data;
    router.push(`/checkout/${orderId}?cs=${encodeURIComponent(clientSecret)}`);
  }

  async function shareEvent() {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: event?.title ?? "Event", url: shareUrl });
        return;
      } catch {
        // Let clipboard fallback handle cancelled native share flows too.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    } catch {
      toast.error("Unable to copy link");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
        <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--page-bg,#f8f8f8)] text-center">
        <h1 className="text-3xl font-bold text-neutral-900">Event Not Found</h1>
        <p className="mt-2 text-neutral-600">This event may have ended or been removed.</p>
        <Button className="mt-6" onClick={() => router.push("/events")}>
          Browse Events
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
      <div className="h-2 bg-gradient-to-r from-[var(--theme-accent)] to-[rgb(59,130,246)]" />

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{event.title}</h1>
                <Button type="button" variant="outline" onClick={shareEvent}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>

              <div className="mt-4 space-y-2 text-sm text-neutral-600">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" />
                  {formatDateTime(event.startAt)} - {formatDateTime(event.endAt)}
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
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {event.description}
                </p>
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

            <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-neutral-900">Organiser</h2>
              <p className="font-medium text-neutral-900">
                {event.organizerProfile.brandName ??
                  event.organizerProfile.companyName ??
                  "Event Organiser"}
              </p>
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

          <div className="space-y-4">
            <section className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.3)] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-neutral-900">Select Tickets</h2>

              {event.ticketTypes.length === 0 ? (
                <p className="text-sm text-neutral-500">No tickets available at this time.</p>
              ) : (
                <div className="space-y-3">
                  {event.ticketTypes.map((ticketType) => {
                    const available = ticketType.quantity - ticketType.sold;
                    const isSoldOut = available <= 0;
                    const qty = cart[ticketType.id] ?? 0;

                    return (
                      <div
                        key={ticketType.id}
                        className={`rounded-xl border p-4 ${
                          isSoldOut
                            ? "border-neutral-200 bg-neutral-50 opacity-60"
                            : "border-[var(--border)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-neutral-900">{ticketType.name}</p>
                            {ticketType.description && (
                              <p className="mt-0.5 text-xs text-neutral-500">
                                {ticketType.description}
                              </p>
                            )}
                            {isSoldOut ? (
                              <Badge className="mt-1 border-transparent bg-red-100 text-xs text-red-700">
                                Sold out
                              </Badge>
                            ) : available <= 10 ? (
                              <Badge className="mt-1 border-transparent bg-amber-100 text-xs text-amber-700">
                                Only {available} left
                              </Badge>
                            ) : null}
                          </div>
                          <p className="shrink-0 text-lg font-bold text-neutral-900">
                            ${Number(ticketType.price).toFixed(2)}
                          </p>
                        </div>

                        {!isSoldOut && (
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setQty(ticketType.id, Math.max(0, qty - 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-neutral-700 transition hover:bg-neutral-100"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setQty(
                                  ticketType.id,
                                  Math.min(ticketType.maxPerOrder, available, qty + 1),
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-neutral-700 transition hover:bg-neutral-100"
                            >
                              +
                            </button>
                            <span className="text-xs text-neutral-400">
                              Max {ticketType.maxPerOrder} per order
                            </span>
                          </div>
                        )}

                        {isSoldOut && (
                          <div className="mt-3 space-y-2">
                            {waitlistMessageByTicket[ticketType.id] ? (
                              <p className="text-xs font-medium text-emerald-700">
                                {waitlistMessageByTicket[ticketType.id]}
                              </p>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setWaitlistOpenTicketId((prev) =>
                                      prev === ticketType.id ? null : ticketType.id,
                                    );
                                    setWaitlistEmail((prev) => prev || buyerEmail.trim());
                                    setWaitlistName("");
                                    setWaitlistErrorByTicket((prev) => ({
                                      ...prev,
                                      [ticketType.id]: "",
                                    }));
                                  }}
                                >
                                  Join Waitlist
                                </Button>
                                {waitlistOpenTicketId === ticketType.id && (
                                  <div className="space-y-2 rounded-lg border border-[var(--border)] bg-white p-3">
                                    <Input
                                      type="email"
                                      value={waitlistEmail}
                                      onChange={(event) => setWaitlistEmail(event.target.value)}
                                      placeholder="Your email"
                                    />
                                    <Input
                                      value={waitlistName}
                                      onChange={(event) => setWaitlistName(event.target.value)}
                                      placeholder="Your name (optional)"
                                    />
                                    {waitlistErrorByTicket[ticketType.id] && (
                                      <p className="text-xs text-red-600">
                                        {waitlistErrorByTicket[ticketType.id]}
                                      </p>
                                    )}
                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void joinWaitlist(ticketType.id)}
                                        disabled={waitlistSubmittingFor === ticketType.id}
                                      >
                                        {waitlistSubmittingFor === ticketType.id
                                          ? "Joining..."
                                          : "Confirm"}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setWaitlistOpenTicketId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {cartItems.length > 0 && (
              <section className="rounded-2xl border border-[var(--border)] bg-white p-5 text-sm shadow-sm">
                <h3 className="mb-3 font-semibold text-neutral-900">Promo Code</h3>
                <div className="flex gap-2">
                  <Input
                    value={promoCode}
                    onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                    placeholder="Enter promo code"
                    maxLength={20}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyPromo}
                    disabled={applyingPromo}
                  >
                    {applyingPromo ? "Applying..." : "Apply"}
                  </Button>
                </div>
                {promoError && <p className="mt-2 text-xs text-red-600">{promoError}</p>}
                {promoSuccess && <p className="mt-2 text-xs text-emerald-600">{promoSuccess}</p>}
              </section>
            )}

            {cartItems.length > 0 && (
              <section className="rounded-2xl border border-[var(--border)] bg-white p-5 text-sm shadow-sm">
                <h3 className="mb-3 font-semibold text-neutral-900">Order Summary</h3>
                {cartItems.map(([ticketTypeId, qty]) => {
                  const ticketType = event.ticketTypes.find((item) => item.id === ticketTypeId);
                  if (!ticketType) return null;

                  return (
                    <div key={ticketTypeId} className="flex justify-between py-1 text-neutral-700">
                      <span>
                        {ticketType.name} x {qty}
                      </span>
                      <span>${(Number(ticketType.price) * qty).toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="my-2 border-t border-[var(--border)]" />
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>- ${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>
                    Platform fee ({commissionPct}%
                    {platformFeeFixed > 0 ? ` + $${platformFeeFixed.toFixed(2)}` : ""})
                  </span>
                  <span>${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>GST ({gstPct}%)</span>
                  <span>${gst.toFixed(2)}</span>
                </div>
                <div className="my-2 border-t border-[var(--border)]" />
                <div className="flex justify-between text-base font-semibold text-neutral-900">
                  <span>Total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </section>
            )}

            {cartItems.length > 0 && (
              <section className="space-y-3 rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.3)] bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-neutral-900">Your Details</h3>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={buyerName}
                    onChange={(event) => setBuyerName(event.target.value)}
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={buyerEmail}
                    onChange={(event) => setBuyerEmail(event.target.value)}
                    placeholder="jane@example.com"
                  />
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
