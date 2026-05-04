import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { prisma } from "@/src/lib/db";
import { Badge } from "@/src/components/ui/badge";
import { formatCurrency } from "@/src/lib/currency";
import NearbyEventsClient from "@/app/events/nearby-events-client";

export const revalidate = 60;

const PAGE_SIZE = 12;

const DURATION_SHORT_MS = 3 * 60 * 60 * 1000;
const DURATION_HALF_MS = 6 * 60 * 60 * 1000;

function parseDateInput(input?: string) {
  if (!input) return undefined;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

async function getPublishedEvents(
  q?: string,
  categoryId?: string,
  stateId?: string,
  from?: string,
  to?: string,
  venueId?: string,
  cityId?: string,
  minPrice?: string,
  maxPrice?: string,
  duration?: string,
  page = 1,
  tag?: string,
  audience?: string,
  availability?: string,
) {
  const fromDate = parseDateInput(from);
  const toDate = to ? parseDateInput(`${to}T23:59:59Z`) : undefined;

  const minPriceNum = minPrice && minPrice !== "" ? parseFloat(minPrice) : undefined;
  const maxPriceNum = maxPrice && maxPrice !== "" ? parseFloat(maxPrice) : undefined;
  const hasMinPrice = minPriceNum !== undefined && !Number.isNaN(minPriceNum);
  const hasMaxPrice = maxPriceNum !== undefined && !Number.isNaN(maxPriceNum);

  const where = {
    status: "PUBLISHED" as const,
    ...(categoryId ? { categoryId } : {}),
    ...(stateId ? { stateId } : {}),
    ...(venueId ? { venueId } : {}),
    ...(cityId ? { cityId } : {}),
    ...(fromDate || toDate
      ? {
          startAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    ...(hasMinPrice || hasMaxPrice
      ? {
          ticketTypes: {
            some: {
              isActive: true,
              price: {
                ...(hasMinPrice ? { gte: minPriceNum } : {}),
                ...(hasMaxPrice ? { lte: maxPriceNum } : {}),
              },
            },
          },
        }
      : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(audience ? { audience } : {}),
    ...(q ? {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const allEvents = await prisma.event.findMany({
    where,
    include: {
      category: { select: { name: true } },
      venue: { select: { name: true } },
      state: { select: { name: true } },
      city: { select: { name: true } },
      ticketTypes: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
        select: { price: true, quantity: true, sold: true, reservedQty: true },
      },
      seatInventory: { select: { status: true, expiresAt: true } },
    },
    orderBy: { startAt: "asc" },
  });

  // Duration filter applied in JS (Prisma cannot compute endAt-startAt)
  const durationFiltered =
    duration && duration !== "any"
      ? allEvents.filter((e) => {
          const ms = e.endAt.getTime() - e.startAt.getTime();
          if (duration === "short") return ms < DURATION_SHORT_MS;
          if (duration === "half") return ms >= DURATION_SHORT_MS && ms < DURATION_HALF_MS;
          if (duration === "full") return ms >= DURATION_HALF_MS;
          return true;
        })
      : allEvents;

  const now = new Date();
  const availabilityFiltered =
    availability && availability !== "any"
      ? durationFiltered.filter((event) => {
          const ticketAvailability = event.ticketTypes.reduce(
            (sum, ticket) => sum + Math.max(0, ticket.quantity - ticket.sold - ticket.reservedQty),
            0,
          );
          const seatAvailability = event.seatInventory.filter((seat) =>
            seat.status === "AVAILABLE" ||
            (seat.status === "RESERVED" && seat.expiresAt !== null && seat.expiresAt <= now),
          ).length;
          const hasAvailability = ticketAvailability > 0 || seatAvailability > 0;
          return availability === "available" ? hasAvailability : !hasAvailability;
        })
      : durationFiltered;

  const total = availabilityFiltered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const events = availabilityFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { events, total, pages };
}

async function getCategories() {
  return prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

async function getStates() {
  return prisma.state.findMany({ orderBy: { name: "asc" } });
}

async function getVenues() {
  return prisma.venue.findMany({
    where: { status: "APPROVED" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

async function getCitiesForState(stateId?: string) {
  if (!stateId) return [];
  return prisma.city.findMany({
    where: { stateId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

function formatDate(iso: Date | string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function buildQuery(sp: Record<string, string | undefined>, overrides: Record<string, string | number | undefined>) {
  const merged: Record<string, string | number> = {};
  const keys = [
    "q", "category", "state", "from", "to",
    "venueId", "cityId", "minPrice", "maxPrice", "duration", "page", "tag", "audience", "availability",
  ] as const;
  for (const k of keys) {
    const v = k in overrides ? overrides[k] : sp[k];
    if (v !== undefined && v !== "") merged[k] = v;
  }
  return merged;
}

export default async function PublicEventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    state?: string;
    from?: string;
    to?: string;
    venueId?: string;
    cityId?: string;
    minPrice?: string;
    maxPrice?: string;
    duration?: string;
    page?: string;
    tag?: string;
    audience?: string;
    availability?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [{ events, total, pages }, categories, states, venues, cities] = await Promise.all([
    getPublishedEvents(
      sp.q,
      sp.category,
      sp.state,
      sp.from,
      sp.to,
      sp.venueId,
      sp.cityId,
      sp.minPrice,
      sp.maxPrice,
      sp.duration,
      page,
      sp.tag,
      sp.audience,
      sp.availability,
    ),
    getCategories(),
    getStates(),
    getVenues(),
    getCitiesForState(sp.state),
  ]);

  const activeFilters = [
    sp.from && { label: `From: ${sp.from}`, key: "from" },
    sp.to && { label: `To: ${sp.to}`, key: "to" },
    sp.venueId && { label: `Venue: ${venues.find((v) => v.id === sp.venueId)?.name ?? sp.venueId}`, key: "venueId" },
    sp.cityId && { label: `City: ${cities.find((c) => c.id === sp.cityId)?.name ?? sp.cityId}`, key: "cityId" },
    sp.minPrice && { label: `Min $${sp.minPrice}`, key: "minPrice" },
    sp.maxPrice && { label: `Max $${sp.maxPrice}`, key: "maxPrice" },
    sp.duration && sp.duration !== "any" && {
      label: sp.duration === "short" ? "Duration: <3h" : sp.duration === "half" ? "Duration: 3-6h" : "Duration: 6h+",
      key: "duration",
    },
    sp.tag && { label: `Tag: #${sp.tag}`, key: "tag" },
    sp.audience && { label: `Audience: ${sp.audience}`, key: "audience" },
    sp.availability && sp.availability !== "any" && {
      label: sp.availability === "available" ? "Available tickets" : "Sold out only",
      key: "availability",
    },
  ].filter(Boolean) as Array<{ label: string; key: string }>;

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[rgb(var(--theme-accent-rgb)/0.12)] to-white px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">Find Events Near You</h1>
        <p className="mt-3 text-lg text-neutral-600">Discover concerts, workshops, sports, and more.</p>

        <form method="GET" action="/events" className="mx-auto mt-8 flex max-w-4xl flex-col gap-3">
          {/* Row 1: search + category + state + dates + submit */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              name="q"
              defaultValue={sp.q}
              type="search"
              placeholder="Search events..."
              className="h-12 flex-1 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--theme-accent-rgb)/0.3)]"
            />
            <select
              name="category"
              defaultValue={sp.category}
              className="h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              name="state"
              defaultValue={sp.state}
              className="h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            >
              <option value="">All locations</option>
              {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input
              name="from"
              type="date"
              defaultValue={sp.from}
              className="h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            />
            <input
              name="to"
              type="date"
              defaultValue={sp.to}
              className="h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            />
            <button
              type="submit"
              className="h-12 rounded-xl bg-[var(--theme-accent)] px-6 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Search
            </button>
          </div>

          {/* Row 2: advanced filters */}
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* City dropdown — only shown when a state is selected */}
            {cities.length > 0 ? (
              <select
                name="cityId"
                defaultValue={sp.cityId}
                className="h-12 flex-1 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
              >
                <option value="">All cities</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              /* Hidden input preserves value if state changes make cities disappear */
              sp.cityId ? <input type="hidden" name="cityId" value="" /> : null
            )}

            {/* Venue dropdown */}
            <select
              name="venueId"
              defaultValue={sp.venueId}
              className="h-12 flex-1 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            >
              <option value="">All venues</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>

            {/* Price range */}
            <input
              name="minPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={sp.minPrice}
              placeholder="Min price"
              className="h-12 w-32 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            />
            <input
              name="maxPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={sp.maxPrice}
              placeholder="Max price"
              className="h-12 w-32 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            />

            {/* Duration */}
            <select
              name="availability"
              defaultValue={sp.availability ?? "any"}
              className="h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            >
              <option value="any">Any availability</option>
              <option value="available">Available tickets</option>
              <option value="soldOut">Sold out only</option>
            </select>

            <select
              name="duration"
              defaultValue={sp.duration ?? "any"}
              className="h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            >
              <option value="any">Any duration</option>
              <option value="short">Short (&lt;3h)</option>
              <option value="half">Half day (3-6h)</option>
              <option value="full">Full day (6h+)</option>
            </select>

            {/* Tag */}
            <input
              name="tag"
              type="text"
              defaultValue={sp.tag}
              placeholder="Tag"
              className="h-12 w-32 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            />

            {/* Audience */}
            <select
              name="audience"
              defaultValue={sp.audience ?? ""}
              className="h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
            >
              <option value="">Any audience</option>
              <option value="Families">Families</option>
              <option value="Kids (Under 12)">Kids (Under 12)</option>
              <option value="Teens (13-17)">Teens (13-17)</option>
              <option value="18+">18+</option>
              <option value="21+">21+</option>
              <option value="Professionals">Professionals</option>
              <option value="Seniors">Seniors</option>
            </select>
          </div>
        </form>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="mx-auto mt-3 flex max-w-4xl flex-wrap justify-center gap-2">
            {activeFilters.map(({ label, key }) => (
              <Link
                key={key}
                href={{ query: buildQuery(sp, { [key]: undefined, page: undefined }) }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-neutral-700"
              >
                {label}
                <span aria-hidden>×</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Events grid */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        <NearbyEventsClient />

        {events.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg font-medium text-neutral-700">No events found</p>
            <p className="mt-2 text-sm text-neutral-500">Try a different search or check back later.</p>
            <Link href="/events" className="mt-4 inline-block text-sm text-[var(--theme-accent)] underline underline-offset-4">
              Clear filters
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-neutral-500">
              {total} event{total !== 1 ? "s" : ""} found
              {pages > 1 && ` · Page ${page} of ${pages}`}
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => {
                const lowestPrice = event.ticketTypes.length > 0
                  ? Math.min(...event.ticketTypes.map((ticket) => Number(ticket.price)))
                  : null;
                const totalQty = event.ticketTypes.reduce((sum, t) => sum + t.quantity, 0);
                const totalSold = event.ticketTypes.reduce((sum, t) => sum + t.sold, 0);
                const totalReserved = event.ticketTypes.reduce((sum, ticket) => sum + ticket.reservedQty, 0);
                const available = totalQty - totalSold - totalReserved;

                return (
                  <Link key={event.id} href={`/events/${event.slug}`} className="group block">
                    <article className="h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm transition group-hover:shadow-lg group-hover:border-[rgb(var(--theme-accent-rgb)/0.3)]">
                      {event.heroImage ? (
                        <div
                          className="h-40 w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${event.heroImage})` }}
                        />
                      ) : (
                        <div className="h-2 bg-gradient-to-r from-[var(--theme-accent)] to-[rgb(var(--theme-secondary,59,130,246))]" />
                      )}

                      <div className="p-5">
                        <div className="mb-3 flex flex-wrap gap-2">
                          {event.category && <Badge>{event.category.name}</Badge>}
                          {event.reviewCount > 0 && (
                            <Badge className="border-transparent bg-amber-50 text-amber-700">
                              ★ {event.avgRating.toFixed(1)} ({event.reviewCount})
                            </Badge>
                          )}
                          {available <= 0 && <Badge className="bg-red-100 text-red-700 border-transparent">Sold out</Badge>}
                          {available > 0 && available <= 10 && (
                            <Badge className="bg-amber-100 text-amber-700 border-transparent">Only {available} left</Badge>
                          )}
                        </div>

                        <h2 className="text-lg font-semibold leading-snug text-neutral-900 group-hover:text-[var(--theme-accent)] transition">
                          {event.title}
                        </h2>

                        <div className="mt-3 space-y-1.5 text-sm text-neutral-600">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                            {formatDate(event.startAt)}
                          </div>
                          {(event.venue || event.city) && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                              {event.venue?.name ?? ""}{event.city ? `, ${event.city.name}` : ""}
                            </div>
                          )}
                          {lowestPrice !== null && (
                            <div className="flex items-center gap-2">
                              <Ticket className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                              From <strong className="text-neutral-900">{formatCurrency(lowestPrice, event.currency ?? 'USD')}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={{ query: buildQuery(sp, { page: page - 1 }) }}
                    className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition"
                  >
                    ← Previous
                  </Link>
                )}
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
                  .map((p, idx, arr) => (
                    <>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span key={`ellipsis-${p}`} className="px-2 text-neutral-400">…</span>
                      )}
                      <Link
                        key={p}
                        href={{ query: buildQuery(sp, { page: p }) }}
                        className={`rounded-xl border px-4 py-2 text-sm font-medium shadow-sm transition ${
                          p === page
                            ? "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white"
                            : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {p}
                      </Link>
                    </>
                  ))
                }
                {page < pages && (
                  <Link
                    href={{ query: buildQuery(sp, { page: page + 1 }) }}
                    className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
