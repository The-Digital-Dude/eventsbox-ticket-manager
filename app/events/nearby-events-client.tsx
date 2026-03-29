"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, LoaderCircle, LocateFixed, MapPin, Star, Ticket } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { formatCurrency } from "@/src/lib/currency";

type NearbyEvent = {
  id: string;
  slug: string;
  title: string;
  heroImage: string | null;
  startAt: string;
  currency: string | null;
  avgRating: number;
  reviewCount: number;
  distanceKm?: number | null;
  category?: {
    name: string;
  } | null;
  venue?: {
    name: string;
  } | null;
  city?: {
    name: string;
  } | null;
  ticketTypes: Array<{
    price: number | string;
    quantity: number;
    sold: number;
    reservedQty: number;
  }>;
};

type NearbyEventsPayload = {
  data?: {
    events: NearbyEvent[];
    radiusKm: number;
  };
  error?: {
    message?: string;
  };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getLocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access was blocked. Enable it in your browser to see nearby events.";
  }

  if (error.code === error.TIMEOUT) {
    return "Location took too long to load. Try again in a moment.";
  }

  return "We couldn't read your location just now. Please try again.";
}

export default function NearbyEventsClient() {
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [radiusKm, setRadiusKm] = useState(25);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function findNearbyEvents() {
    if (loading) return;
    if (!navigator.geolocation) {
      setHasSearched(true);
      setMessage("Your browser doesn't support location sharing.");
      setEvents([]);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const params = new URLSearchParams({
          lat: position.coords.latitude.toString(),
          lng: position.coords.longitude.toString(),
          radiusKm: radiusKm.toString(),
          limit: "4",
        });

        try {
          const res = await fetch(`/api/public/events/nearby?${params.toString()}`, {
            cache: "no-store",
          });
          const payload = (await res.json()) as NearbyEventsPayload;

          if (!res.ok) {
            setMessage(payload.error?.message ?? "Unable to load nearby events right now.");
            setEvents([]);
            return;
          }

          setRadiusKm(payload.data?.radiusKm ?? radiusKm);
          setEvents(payload.data?.events ?? []);
          if ((payload.data?.events.length ?? 0) === 0) {
            setMessage(`No events found within ${payload.data?.radiusKm ?? radiusKm} km yet.`);
          }
        } catch {
          setMessage("Unable to load nearby events right now.");
          setEvents([]);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setMessage(getLocationErrorMessage(error));
        setEvents([]);
        setLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white shadow-sm">
      <div className="bg-[linear-gradient(135deg,rgba(var(--theme-accent-rgb),0.12),rgba(255,255,255,0.95))] px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--theme-accent)]">
              Nearby Picks
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-neutral-900">
              See what&apos;s happening around you
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Use your browser location to pull upcoming events within {radiusKm} km. We only request
              it when you ask.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void findNearbyEvents()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--theme-accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {loading ? "Finding nearby events..." : hasSearched ? "Refresh nearby events" : "Use my location"}
          </button>
        </div>
      </div>

      {(message || events.length > 0) && (
        <div className="space-y-4 px-6 py-6">
          {message && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              {message}
            </div>
          )}

          {events.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {events.map((event) => {
                const lowestPrice = event.ticketTypes[0] ? Number(event.ticketTypes[0].price) : null;
                const totalQty = event.ticketTypes.reduce((sum, ticket) => sum + ticket.quantity, 0);
                const totalSold = event.ticketTypes.reduce((sum, ticket) => sum + ticket.sold, 0);
                const totalReserved = event.ticketTypes.reduce((sum, ticket) => sum + ticket.reservedQty, 0);
                const available = totalQty - totalSold - totalReserved;

                return (
                  <Link key={event.id} href={`/events/${event.slug}`} className="group block">
                    <article className="h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm transition group-hover:border-[rgb(var(--theme-accent-rgb)/0.3)] group-hover:shadow-md">
                      {event.heroImage ? (
                        <div
                          className="h-32 w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${event.heroImage})` }}
                        />
                      ) : (
                        <div className="h-2 bg-gradient-to-r from-[var(--theme-accent)] to-[rgb(var(--theme-secondary,59,130,246))]" />
                      )}

                      <div className="space-y-3 p-4">
                        <div className="flex flex-wrap gap-2">
                          {event.category && <Badge>{event.category.name}</Badge>}
                          {typeof event.distanceKm === "number" && (
                            <Badge className="border-transparent bg-sky-50 text-sky-700">
                              {event.distanceKm.toFixed(1)} km away
                            </Badge>
                          )}
                          {event.reviewCount > 0 && (
                            <Badge className="border-transparent bg-amber-50 text-amber-700">
                              <Star className="mr-1 h-3 w-3 fill-current" />
                              {event.avgRating.toFixed(1)}
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-base font-semibold leading-snug text-neutral-900 transition group-hover:text-[var(--theme-accent)]">
                          {event.title}
                        </h3>

                        <div className="space-y-1.5 text-sm text-neutral-600">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                            {formatDate(event.startAt)}
                          </div>
                          {(event.venue || event.city) && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                              {event.venue?.name ?? ""}
                              {event.city ? `, ${event.city.name}` : ""}
                            </div>
                          )}
                          {lowestPrice !== null && (
                            <div className="flex items-center gap-2">
                              <Ticket className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                              From{" "}
                              <strong className="text-neutral-900">
                                {formatCurrency(lowestPrice, event.currency ?? "USD")}
                              </strong>
                            </div>
                          )}
                        </div>

                        {available <= 10 && totalQty > 0 && (
                          <p className="text-xs font-medium text-amber-700">
                            {available <= 0 ? "Sold out" : `Only ${available} tickets left`}
                          </p>
                        )}
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
