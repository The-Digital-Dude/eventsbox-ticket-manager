"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, Mail, MapPin, Phone, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SeatMapLive } from "@/src/components/shared/seat-map-live";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { listSeatDescriptors } from "@/src/lib/venue-seating";
import { formatCurrency } from "@/src/lib/currency";
import { getVideoEmbedUrl } from "@/src/lib/video";
import type {
  PublicSeatBookingState,
  SeatingSection,
  SeatState,
  VenueSeatingConfig,
} from "@/src/types/venue-seating";

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  sectionId: string | null;
  price: number | string;
  quantity: number;
  sold: number;
  reservedQty: number;
  maxPerOrder: number;
  saleStartAt: string | null;
  saleEndAt: string | null;
};

type EventDetail = {
  id: string;
  title: string;
  slug: string;
  heroImage: string | null;
  images: string[];
  videoUrl: string | null;
  description: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  cancelPolicy: string | null;
  refundPolicy: string | null;
  currency: string;
  gstPct: number | string;
  commissionPct: number | string;
  platformFeeFixed: number | string;
  category: { name: string } | null;
  series: { id: string; title: string } | null;
  venue: {
    name: string;
    addressLine1: string;
    seatingConfig?: VenueSeatingConfig | null;
    seatState?: Record<string, SeatState> | null;
  } | null;
  state: { name: string } | null;
  city: { name: string } | null;
  ticketTypes: TicketType[];
  organizerProfile: {
    id: string;
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

type SeatAvailabilityPayload = {
  seatingEnabled: boolean;
  statuses: Record<string, PublicSeatBookingState>;
  refreshIntervalMs: number;
  updatedAt: string;
};

type CheckoutSessionState =
  | "loading"
  | null
  | {
      name: string;
      email: string;
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
  const [session, setSession] = useState<CheckoutSessionState>("loading");
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
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [seatAvailability, setSeatAvailability] = useState<Record<string, PublicSeatBookingState>>({});
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [seatAvailabilityLoading, setSeatAvailabilityLoading] = useState(false);
  const [seatPollIntervalMs, setSeatPollIntervalMs] = useState(10_000);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!active) return;

        if (!response.ok) {
          setSession(null);
          return;
        }

        const payload = (await response.json()) as {
          data?: { email?: string; displayName?: string | null };
        };
        const email = payload.data?.email?.trim();
        if (!email) {
          setSession(null);
          return;
        }

        setSession({
          name: payload.data?.displayName?.trim() || email,
          email,
        });
      } catch {
        if (active) {
          setSession(null);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session || session === "loading") {
      return;
    }

    setBuyerName((current) => current || session.name);
    setBuyerEmail((current) => current || session.email);
  }, [session]);

  useEffect(() => {
    if (!event?.venue?.seatingConfig) {
      setSeatAvailability({});
      setSeatAvailabilityLoading(false);
      return;
    }

    let active = true;

    async function loadSeatAvailability(showLoading: boolean) {
      if (showLoading) {
        setSeatAvailabilityLoading(true);
      }

      try {
        const response = await fetch(`/api/public/events/${slug}/seats`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { data?: SeatAvailabilityPayload };
        if (!active || !payload.data) {
          return;
        }

        setSeatAvailability(payload.data.statuses ?? {});
        setSeatPollIntervalMs(payload.data.refreshIntervalMs ?? 10_000);
      } finally {
        if (active) {
          setSeatAvailabilityLoading(false);
        }
      }
    }

    void loadSeatAvailability(true);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void loadSeatAvailability(false);
    }, seatPollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [event?.venue?.seatingConfig, seatPollIntervalMs, slug]);

  useEffect(() => {
    if (!selectedImage) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedImage(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedImage]);

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

  const currency = event?.currency ?? 'USD';
  const commissionPct = Number(event?.commissionPct ?? 10);
  const gstPct = Number(event?.gstPct ?? 15);
  const platformFeeFixed = Number(event?.platformFeeFixed ?? 0);
  const platformFee = parseFloat(
    (discountedSubtotal * (commissionPct / 100) + platformFeeFixed).toFixed(2),
  );
  const gst = parseFloat(((discountedSubtotal + platformFee) * (gstPct / 100)).toFixed(2));
  const grandTotal = parseFloat((discountedSubtotal + platformFee + gst).toFixed(2));
  const totalSelectedTickets = cartItems.reduce((sum, [, qty]) => sum + qty, 0);
  const requiresSeatSelection = Boolean(
    event?.venue?.seatingConfig &&
    event.ticketTypes.some((t) => t.sectionId),
  );
  // Only count tickets tied to a section — GA tickets need no seat
  const totalSeatedTickets = cartItems.reduce((sum, [ticketTypeId, qty]) => {
    const tt = event?.ticketTypes.find((t) => t.id === ticketTypeId);
    return tt?.sectionId ? sum + qty : sum;
  }, 0);
  const bookedSeatCount = Object.values(seatAvailability).filter((seat) => seat.status === "BOOKED").length;
  const reservedSeatCount = Object.values(seatAvailability).filter((seat) => seat.status === "RESERVED").length;

  useEffect(() => {
    setSelectedSeatIds((prev) => prev.slice(0, totalSeatedTickets));
  }, [totalSeatedTickets]);

  useEffect(() => {
    setSelectedSeatIds((prev) =>
      prev.filter((seatId) => (seatAvailability[seatId]?.status ?? "AVAILABLE") === "AVAILABLE"),
    );
  }, [seatAvailability]);

  function toggleSeatSelection(seatId: string) {
    if (!requiresSeatSelection) return;
    if (totalSeatedTickets <= 0) {
      toast.error("Select your ticket quantity first");
      return;
    }

    const availability = seatAvailability[seatId]?.status ?? "AVAILABLE";
    if (availability !== "AVAILABLE" && !selectedSeatIds.includes(seatId)) {
      return;
    }

    setSelectedSeatIds((prev) => {
      if (prev.includes(seatId)) {
        return prev.filter((entry) => entry !== seatId);
      }

      if (prev.length >= totalSeatedTickets) {
        toast.error(`You can only select ${totalSeatedTickets} seat${totalSeatedTickets === 1 ? "" : "s"}`);
        return prev;
      }

      return [...prev, seatId];
    });
  }

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
          : formatCurrency(Number(promoData.discountValue), currency)
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
    if (session === "loading") return toast.error("Checking your session");
    if (!session) return toast.error("Sign in to purchase tickets");
    if (!buyerName.trim()) return toast.error("Enter your name");
    if (!buyerEmail.trim()) return toast.error("Enter your email");
    if (requiresSeatSelection && selectedSeatIds.length !== totalSeatedTickets) {
      return toast.error(`Select ${totalSeatedTickets} seat${totalSeatedTickets === 1 ? "" : "s"} before checkout`);
    }

    setCheckingOut(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.id,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        items: cartItems.map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
        ...(requiresSeatSelection ? { selectedSeatIds } : {}),
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

  function getSectionStats(section: SeatingSection) {
    const descriptors = listSeatDescriptors(
      { ...event!.venue!.seatingConfig!, sections: [section] },
      event!.venue!.seatState,
    );
    const total = descriptors.length;
    const booked = descriptors.filter((d) => seatAvailability[d.seatId]?.status === "BOOKED").length;
    const reserved = descriptors.filter((d) => seatAvailability[d.seatId]?.status === "RESERVED").length;
    const available = total - booked - reserved;
    return { total, booked, reserved, available };
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

  const eventRedirectPath = `/events/${slug}`;
  const loginUrl = `/auth/login?redirect=${encodeURIComponent(eventRedirectPath)}`;
  const registerUrl = `/auth/register/attendee?redirect=${encodeURIComponent(eventRedirectPath)}`;
  const galleryImages = event.images ?? [];

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

            {galleryImages.length > 0 && (
              <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Gallery</h2>
                    <p className="text-sm text-neutral-500">More moments from this event.</p>
                  </div>
                  <Badge>{galleryImages.length} photos</Badge>
                </div>
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                  {galleryImages.map((imageUrl, index) => (
                    <button
                      key={`${imageUrl}-${index}`}
                      type="button"
                      onClick={() => setSelectedImage(imageUrl)}
                      className="shrink-0 overflow-hidden rounded-xl border border-[var(--border)] transition hover:opacity-90"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt={`${event.title} gallery image ${index + 1}`}
                        className="h-28 w-40 object-cover sm:h-32 sm:w-48"
                      />
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {event.category && <Badge>{event.category.name}</Badge>}
                {event.series ? (
                  <Link href={`/events/series/${event.series.id}`}>
                    <Badge className="border-transparent bg-sky-100 text-sky-700 transition hover:bg-sky-200">
                      Part of {event.series.title}
                    </Badge>
                  </Link>
                ) : null}
              </div>
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

            {event.videoUrl && getVideoEmbedUrl(event.videoUrl) && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Event Preview</h3>
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
                  <iframe
                    src={getVideoEmbedUrl(event.videoUrl)!}
                    title="Event preview video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              </div>
            )}

            {(event.venue?.seatingConfig?.sections.length ?? 0) > 0 || event.ticketTypes.some((t) => !t.sectionId) ? (
              <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <h2 className="mb-1 text-lg font-semibold text-neutral-900">Ticket Categories</h2>
                <p className="mb-4 text-sm text-neutral-500">
                  Available ticket types and seating sections for this event.
                </p>
                <div className="space-y-3">
                  {/* Seated sections — only shown when a ticket type is linked */}
                  {(event.venue?.seatingConfig?.sections ?? []).map((section) => {
                    const linkedTicket = event.ticketTypes.find((t) => t.sectionId === section.id);
                    if (!linkedTicket) return null;
                    const stats = getSectionStats(section);
                    const isExpanded = expandedSectionId === section.id;
                    return (
                      <div key={section.id} className="overflow-hidden rounded-xl border border-[var(--border)]">
                        <div className="flex items-center justify-between gap-3 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-neutral-900">{linkedTicket.name}</p>
                            <Badge>{section.mapType.toUpperCase()}</Badge>
                            <Badge className="border-transparent bg-emerald-100 text-emerald-700">
                              {formatCurrency(Number(linkedTicket.price), currency)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-neutral-500">{stats.available} available</span>
                            {stats.booked > 0 && (
                              <Badge className="border-transparent bg-red-100 text-red-700">{stats.booked} booked</Badge>
                            )}
                            {stats.reserved > 0 && (
                              <Badge className="border-transparent bg-amber-100 text-amber-700">{stats.reserved} reserved</Badge>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedSectionId(isExpanded ? null : section.id)}
                              className="ml-2 rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium transition hover:bg-neutral-50"
                            >
                              {isExpanded ? "Hide layout" : "View layout"}
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="overflow-x-auto border-t border-[var(--border)] p-4">
                            <SeatMapLive
                              config={{ ...event.venue!.seatingConfig!, sections: [section] }}
                              seatState={event.venue!.seatState}
                              bookingStates={seatAvailability}
                              selectedSeatIds={selectedSeatIds}
                              onSeatToggle={toggleSeatSelection}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* General Admission — ticket types with no section */}
                  {event.ticketTypes.filter((t) => !t.sectionId).map((ticket) => {
                    const available = ticket.quantity - ticket.sold - ticket.reservedQty;
                    return (
                      <div key={ticket.id} className="rounded-xl border border-[var(--border)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-neutral-900">{ticket.name}</p>
                            <Badge className="border-transparent bg-neutral-100 text-neutral-600">
                              GENERAL ADMISSION
                            </Badge>
                            <Badge className="border-transparent bg-emerald-100 text-emerald-700">
                              {formatCurrency(Number(ticket.price), currency)}
                            </Badge>
                          </div>
                          <span className="text-xs text-neutral-500">{available} available</span>
                        </div>
                        {ticket.description && (
                          <p className="mt-2 text-sm text-neutral-500">{ticket.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {event.venue?.seatingConfig && (
              <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Seating plan</h2>
                    <p className="mt-1 text-sm text-neutral-600">
                      Pick your seats and watch live availability update automatically.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge className="border-transparent bg-red-100 text-red-700">
                      {bookedSeatCount} booked
                    </Badge>
                    {reservedSeatCount > 0 ? (
                      <Badge className="border-transparent bg-amber-100 text-amber-700">
                        {reservedSeatCount} reserved
                      </Badge>
                    ) : null}
                    {selectedSeatIds.length > 0 ? (
                      <Badge className="border-transparent bg-sky-100 text-sky-700">
                        {selectedSeatIds.length} selected
                      </Badge>
                    ) : null}
                    {seatAvailabilityLoading ? <Badge>Refreshing…</Badge> : null}
                  </div>
                </div>
                <SeatMapLive
                  config={event.venue.seatingConfig}
                  seatState={event.venue.seatState}
                  bookingStates={seatAvailability}
                  selectedSeatIds={selectedSeatIds}
                  onSeatToggle={toggleSeatSelection}
                />
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
              <Link
                href={`/organizers/${event.organizerProfile.id}`}
                className="mt-4 inline-flex text-sm font-medium text-[var(--theme-accent)] transition hover:underline"
              >
                More events by{" "}
                {event.organizerProfile.brandName ??
                  event.organizerProfile.companyName ??
                  "this organiser"}
              </Link>
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
                    const available = ticketType.quantity - ticketType.sold - ticketType.reservedQty;
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
                            {formatCurrency(Number(ticketType.price), currency)}
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
                      <span>{formatCurrency(Number(ticketType.price) * qty, currency)}</span>
                    </div>
                  );
                })}
                <div className="my-2 border-t border-[var(--border)]" />
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(cartTotal, currency)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>- {formatCurrency(discountAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>
                    Platform fee ({commissionPct}%
                    {platformFeeFixed > 0 ? ` + ${formatCurrency(platformFeeFixed, currency)}` : ""})
                  </span>
                  <span>{formatCurrency(platformFee, currency)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>GST ({gstPct}%)</span>
                  <span>{formatCurrency(gst, currency)}</span>
                </div>
                <div className="my-2 border-t border-[var(--border)]" />
                <div className="flex justify-between text-base font-semibold text-neutral-900">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal, currency)}</span>
                </div>
                {requiresSeatSelection && (
                  <div className="mt-3 rounded-xl border border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.05)] px-3 py-2 text-xs text-neutral-700">
                    Seats selected: {selectedSeatIds.length}/{totalSeatedTickets}
                  </div>
                )}
              </section>
            )}

            {cartItems.length > 0 && (
              <section className="space-y-3 rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.3)] bg-white p-5 shadow-sm">
                {session === "loading" ? (
                  <>
                    <div className="h-5 w-36 animate-pulse rounded bg-neutral-100" />
                    <div className="space-y-2">
                      <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
                      <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
                    </div>
                  </>
                ) : session === null ? (
                  <>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-neutral-900">Sign in to purchase</h3>
                      <p className="text-sm text-neutral-600">
                        Create an account or sign in to complete your purchase and access your tickets.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Link
                        href={loginUrl}
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--theme-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(var(--theme-accent-rgb)/0.92)]"
                      >
                        Sign In
                      </Link>
                      <Link
                        href={registerUrl}
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-[rgb(var(--theme-accent-rgb)/0.05)]"
                      >
                        Register
                      </Link>
                    </div>
                    <p className="text-center text-xs text-neutral-400">
                      Your tickets will appear in your account after purchase.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                        Purchasing As
                      </p>
                      <p className="mt-1 text-sm font-semibold text-neutral-900">{session.name}</p>
                      <p className="text-sm text-neutral-600">{session.email}</p>
                    </div>
                    <Button className="w-full" onClick={checkout} disabled={checkingOut}>
                      {checkingOut ? "Processing..." : `Pay ${formatCurrency(grandTotal, currency)}`}
                    </Button>
                    <p className="text-center text-xs text-neutral-400">Secured by Stripe</p>
                  </>
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white transition hover:bg-black"
            >
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt={`${event.title} full-size gallery preview`}
              className="max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
