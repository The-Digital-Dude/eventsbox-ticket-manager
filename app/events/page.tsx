import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { prisma } from "@/src/lib/db";
import { Badge } from "@/src/components/ui/badge";

export const revalidate = 60;

async function getPublishedEvents(q?: string, categoryId?: string, stateId?: string) {
  return prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      ...(categoryId ? { categoryId } : {}),
      ...(stateId ? { stateId } : {}),
      ...(q ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: {
      category: { select: { name: true } },
      venue: { select: { name: true } },
      state: { select: { name: true } },
      city: { select: { name: true } },
      ticketTypes: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        select: { price: true, quantity: true, sold: true },
        take: 1,
      },
    },
    orderBy: { startAt: "asc" },
  });
}

async function getCategories() {
  return prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

async function getStates() {
  return prisma.state.findMany({ orderBy: { name: "asc" } });
}

function formatDate(iso: Date | string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default async function PublicEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; stateId?: string }>;
}) {
  const sp = await searchParams;
  const [events, categories, states] = await Promise.all([
    getPublishedEvents(sp.q, sp.categoryId, sp.stateId),
    getCategories(),
    getStates(),
  ]);

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[rgb(var(--theme-accent-rgb)/0.12)] to-white px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">Find Events Near You</h1>
        <p className="mt-3 text-lg text-neutral-600">Discover concerts, workshops, sports, and more.</p>

        <form method="GET" action="/events" className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={sp.q}
            type="search"
            placeholder="Search events..."
            className="h-12 flex-1 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--theme-accent-rgb)/0.3)]"
          />
          <select
            name="categoryId"
            defaultValue={sp.categoryId}
            className="h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            name="stateId"
            defaultValue={sp.stateId}
            className="h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-sm shadow-sm focus:outline-none"
          >
            <option value="">All locations</option>
            {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            type="submit"
            className="h-12 rounded-xl bg-[var(--theme-accent)] px-6 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            Search
          </button>
        </form>
      </div>

      {/* Events grid */}
      <div className="mx-auto max-w-6xl px-4 py-10">
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
            <p className="mb-6 text-sm text-neutral-500">{events.length} event{events.length !== 1 ? "s" : ""} found</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => {
                const lowestPrice = event.ticketTypes[0] ? Number(event.ticketTypes[0].price) : null;
                const totalQty = event.ticketTypes.reduce((sum, t) => sum + t.quantity, 0);
                const totalSold = event.ticketTypes.reduce((sum, t) => sum + t.sold, 0);
                const available = totalQty - totalSold;

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
                              From <strong className="text-neutral-900">${lowestPrice.toFixed(2)}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
