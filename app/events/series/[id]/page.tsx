import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { prisma } from "@/src/lib/db";
import { Badge } from "@/src/components/ui/badge";

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PublicSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const series = await prisma.eventSeries.findUnique({
    where: { id },
    include: {
      events: {
        where: { status: "PUBLISHED" },
        orderBy: { startAt: "asc" },
        include: {
          category: { select: { id: true, name: true } },
          venue: { select: { id: true, name: true } },
          state: { select: { id: true, name: true } },
          city: { select: { id: true, name: true } },
          ticketTypes: {
            where: { isActive: true },
            orderBy: { price: "asc" },
            select: { id: true, name: true, price: true, quantity: true, sold: true, reservedQty: true },
          },
        },
      },
    },
  });

  if (!series) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
      <div className="bg-gradient-to-br from-[rgb(var(--theme-accent-rgb)/0.12)] to-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/events"
            className="inline-flex text-sm font-medium text-[var(--theme-accent)] transition hover:underline"
          >
            Back to all events
          </Link>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">
            {series.title}
          </h1>
          <p className="mt-3 max-w-3xl text-base text-neutral-600">
            {series.description || "Explore every published event in this series."}
          </p>
          <p className="mt-4 text-sm text-neutral-500">
            {series.events.length} published event{series.events.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {series.events.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-lg font-medium text-neutral-700">No published events yet</p>
            <p className="mt-2 text-sm text-neutral-500">
              Check back soon for the next event in this series.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {series.events.map((event) => {
              const lowestPrice = event.ticketTypes[0] ? Number(event.ticketTypes[0].price) : null;
              const totalQty = event.ticketTypes.reduce((sum, ticket) => sum + ticket.quantity, 0);
              const totalSold = event.ticketTypes.reduce((sum, ticket) => sum + ticket.sold, 0);
              const totalReserved = event.ticketTypes.reduce((sum, ticket) => sum + ticket.reservedQty, 0);
              const available = totalQty - totalSold - totalReserved;

              return (
                <Link key={event.id} href={`/events/${event.slug}`} className="group block">
                  <article className="h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm transition group-hover:border-[rgb(var(--theme-accent-rgb)/0.3)] group-hover:shadow-lg">
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
                        {event.category ? <Badge>{event.category.name}</Badge> : null}
                        {available <= 0 ? (
                          <Badge className="border-transparent bg-red-100 text-red-700">Sold out</Badge>
                        ) : null}
                        {available > 0 && available <= 10 ? (
                          <Badge className="border-transparent bg-amber-100 text-amber-700">
                            Only {available} left
                          </Badge>
                        ) : null}
                      </div>

                      <h2 className="text-lg font-semibold leading-snug text-neutral-900 transition group-hover:text-[var(--theme-accent)]">
                        {event.title}
                      </h2>

                      <div className="mt-3 space-y-1.5 text-sm text-neutral-600">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                          {formatDate(event.startAt)}
                        </div>
                        {(event.venue || event.city) ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                            {event.venue?.name ?? ""}
                            {event.city ? `, ${event.city.name}` : ""}
                          </div>
                        ) : null}
                        {lowestPrice !== null ? (
                          <div className="flex items-center gap-2">
                            <Ticket className="h-4 w-4 shrink-0 text-[var(--theme-accent)]" />
                            From <strong className="text-neutral-900">${lowestPrice.toFixed(2)}</strong>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
