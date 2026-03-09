import Link from "next/link";
import { CalendarDays, ExternalLink, MapPin, Ticket } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { Badge } from "@/src/components/ui/badge";

export const dynamic = "force-dynamic";

async function getOrganizerProfile(id: string) {
  return prisma.organizerProfile.findFirst({
    where: {
      id,
      approvalStatus: "APPROVED",
    },
    select: {
      id: true,
      brandName: true,
      companyName: true,
      website: true,
      events: {
        where: {
          status: "PUBLISHED",
          startAt: { gte: new Date() },
        },
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          heroImage: true,
          startAt: true,
          category: { select: { name: true } },
          venue: { select: { name: true } },
          city: { select: { name: true } },
          ticketTypes: {
            where: { isActive: true },
            orderBy: { price: "asc" },
            select: { price: true },
            take: 1,
          },
        },
      },
    },
  });
}

function formatDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function OrganizerPublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organizer = await getOrganizerProfile(id);

  if (!organizer) {
    notFound();
  }

  const displayName = organizer.brandName ?? organizer.companyName ?? "EventsBox Organizer";

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f8f8f8)]">
      <section className="border-b border-[var(--border)] bg-gradient-to-br from-[rgb(var(--theme-accent-rgb)/0.12)] via-white to-[rgb(59,130,246,0.08)] px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/events"
            className="text-sm font-medium text-[var(--theme-accent)] transition hover:underline"
          >
            Back to events
          </Link>
          <div className="mt-6 max-w-3xl space-y-4">
            <Badge>Organizer Profile</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">
              {displayName}
            </h1>
            <div className="space-y-2 text-neutral-600">
              <p>{organizer.companyName ?? "Independent organizer"}</p>
              {organizer.website && (
                <a
                  href={organizer.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--theme-accent)] transition hover:underline"
                >
                  Visit website
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Upcoming events
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {organizer.events.length} published event{organizer.events.length === 1 ? "" : "s"} on
              sale right now.
            </p>
          </div>
        </div>

        {organizer.events.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-lg font-medium text-neutral-800">No upcoming events yet</p>
            <p className="mt-2 text-sm text-neutral-500">
              Check back later for the next release from {displayName}.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {organizer.events.map((event) => {
              const lowestPrice = event.ticketTypes[0] ? Number(event.ticketTypes[0].price) : null;

              return (
                <Link key={event.id} href={`/events/${event.slug}`} className="group block">
                  <article className="h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm transition group-hover:border-[rgb(var(--theme-accent-rgb)/0.3)] group-hover:shadow-lg">
                    {event.heroImage ? (
                      <div
                        className="h-40 w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${event.heroImage})` }}
                      />
                    ) : (
                      <div className="h-2 bg-gradient-to-r from-[var(--theme-accent)] to-[rgb(59,130,246)]" />
                    )}

                    <div className="p-5">
                      {event.category && <Badge className="mb-3">{event.category.name}</Badge>}
                      <h3 className="text-lg font-semibold leading-snug text-neutral-900 transition group-hover:text-[var(--theme-accent)]">
                        {event.title}
                      </h3>

                      <div className="mt-3 space-y-1.5 text-sm text-neutral-600">
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
        )}
      </section>
    </div>
  );
}
