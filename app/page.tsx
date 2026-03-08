import Link from "next/link";
import { CalendarDays, MapPin, QrCode, Shield, Ticket } from "lucide-react";
import { prisma } from "@/src/lib/db";

export const revalidate = 60;

async function getStats() {
  const now = new Date();

  const [eventCount, orderCount, featuredEvents] = await Promise.all([
    prisma.event.count({ where: { status: "PUBLISHED" } }),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.event.findMany({
      where: {
        isFeatured: true,
        status: "PUBLISHED",
        startAt: { gte: now },
      },
      include: {
        category: { select: { name: true } },
        city: { select: { name: true } },
        ticketTypes: {
          where: { isActive: true },
          orderBy: { price: "asc" },
          select: { price: true, quantity: true, sold: true },
          take: 1,
        },
      },
      orderBy: { startAt: "asc" },
      take: 6,
    }),
  ]);

  if (featuredEvents.length >= 3) {
    return { eventCount, orderCount, featuredEvents };
  }

  const fallbackEvents = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      startAt: { gte: now },
      id: { notIn: featuredEvents.map((event) => event.id) },
    },
    include: {
      category: { select: { name: true } },
      city: { select: { name: true } },
      ticketTypes: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        select: { price: true, quantity: true, sold: true },
        take: 1,
      },
    },
    orderBy: { startAt: "asc" },
    take: 3 - featuredEvents.length,
  });

  return { eventCount, orderCount, featuredEvents: [...featuredEvents, ...fallbackEvents] };
}

function formatDate(iso: Date) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default async function HomePage() {
  const { eventCount, orderCount, featuredEvents } = await getStats();

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
      {/* Nav */}
      <header className="border-b border-[var(--border)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
            <Ticket className="h-5 w-5 text-[var(--theme-accent)]" />
            EventsBox
          </div>
          <div className="flex items-center gap-2">
            <Link href="/events" className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition">
              Browse Events
            </Link>
            <Link href="/auth/register" className="hidden rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition sm:inline-flex">
              Register
            </Link>
            <Link href="/auth/login" className="rounded-lg bg-[var(--theme-accent)] px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[rgb(var(--theme-accent-rgb)/0.1)] via-white to-[rgb(59,130,246,0.06)] px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--theme-accent-rgb)/0.2)] bg-[rgb(var(--theme-accent-rgb)/0.06)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent)]">
            <Ticket className="h-3.5 w-3.5" /> New Zealand&apos;s Event Ticketing Platform
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-neutral-900 md:text-6xl">
            Sell tickets.<br />
            <span className="text-[var(--theme-accent)]">Effortlessly.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600">
            EventsBox makes it easy to create events, sell tickets, and check in attendees — all in one place.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/events" className="inline-flex h-12 items-center rounded-xl bg-[var(--theme-accent)] px-8 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
              Browse Events
            </Link>
            <Link href="/auth/login" className="inline-flex h-12 items-center rounded-xl border border-[var(--border)] bg-white px-8 text-sm font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50">
              Organiser Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--border)] bg-white py-10">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-3">
            <div>
              <p className="text-4xl font-bold text-[var(--theme-accent)]">{eventCount}+</p>
              <p className="mt-1 text-sm text-neutral-500">Live Events</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[var(--theme-accent)]">{orderCount}+</p>
              <p className="mt-1 text-sm text-neutral-500">Tickets Sold</p>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="text-4xl font-bold text-[var(--theme-accent)]">100%</p>
              <p className="mt-1 text-sm text-neutral-500">Secure Payments</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Events */}
      {featuredEvents.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Upcoming Events</h2>
            <Link href="/events" className="text-sm font-medium text-[var(--theme-accent)] underline underline-offset-4">
              See all →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredEvents.map((event) => {
              const lowestPrice = event.ticketTypes[0] ? Number(event.ticketTypes[0].price) : null;
              return (
                <Link key={event.id} href={`/events/${event.slug}`} className="group block">
                  <article className="h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm transition group-hover:shadow-lg group-hover:border-[rgb(var(--theme-accent-rgb)/0.3)]">
                    {event.heroImage ? (
                      <div className="h-36 w-full bg-cover bg-center" style={{ backgroundImage: `url(${event.heroImage})` }} />
                    ) : (
                      <div className="h-2 bg-gradient-to-r from-[var(--theme-accent)] to-[rgb(59,130,246)]" />
                    )}
                    <div className="p-5">
                      {event.category && (
                        <span className="mb-2 inline-block rounded-full bg-[rgb(var(--theme-accent-rgb)/0.08)] px-2.5 py-0.5 text-xs font-semibold text-[var(--theme-accent)]">
                          {event.category.name}
                        </span>
                      )}
                      <h3 className="text-lg font-semibold leading-snug text-neutral-900 group-hover:text-[var(--theme-accent)] transition">
                        {event.title}
                      </h3>
                      <div className="mt-3 space-y-1.5 text-sm text-neutral-600">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                          {formatDate(event.startAt)}
                        </div>
                        {event.city && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                            {event.city.name}
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
        </section>
      )}

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-neutral-900">
          Everything you need to run events
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: <CalendarDays className="h-6 w-6 text-[var(--theme-accent)]" />,
              title: "Event Management",
              desc: "Create and publish events with multiple ticket types, pricing, and capacity management.",
            },
            {
              icon: <Shield className="h-6 w-6 text-[var(--theme-accent)]" />,
              title: "Secure Payments",
              desc: "Stripe-powered checkout with automatic fee calculation, GST, and instant confirmation.",
            },
            {
              icon: <QrCode className="h-6 w-6 text-[var(--theme-accent)]" />,
              title: "QR Check-in",
              desc: "Every ticket gets a unique QR code. Scan at the door for fast, paperless entry.",
            },
          ].map((f) => (
            <article key={f.title} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <div className="mb-4 inline-flex rounded-xl bg-[rgb(var(--theme-accent-rgb)/0.08)] p-3">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-neutral-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)] bg-[rgb(var(--theme-accent-rgb)/0.06)] px-4 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Ready to get started?</h2>
        <p className="mx-auto mt-4 max-w-md text-neutral-600">Join EventsBox today and start selling tickets to your next event.</p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/events" className="inline-flex h-12 items-center rounded-xl bg-[var(--theme-accent)] px-8 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
            Browse Events
          </Link>
          <Link href="/auth/login" className="inline-flex h-12 items-center rounded-xl border border-[var(--border)] bg-white px-8 text-sm font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50">
            Sign In as Organiser
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-white py-6 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} EventsBox. All rights reserved.
      </footer>
    </div>
  );
}
