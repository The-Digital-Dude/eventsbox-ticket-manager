import Link from "next/link";
import { CalendarDays, Download, FileText, MapPin, QrCode } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { requireAttendee } from "@/src/lib/auth/require-attendee";
import { Badge } from "@/src/components/ui/badge";
import { ResendConfirmationButton } from "@/app/account/tickets/resend-confirmation-button";

type TicketCard = {
  id: string;
  orderId: string;
  ticketNumber: string;
  checkedInAt: Date | null;
  eventTitle: string;
  eventSlug: string;
  eventStartAt: Date;
  venueName: string | null;
  venueAddress: string | null;
  ticketTypeName: string;
};

function formatDateTime(value: Date) {
  return value.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildTicketCards(
  orders: Array<{
    event: {
      title: string;
      slug: string;
      startAt: Date;
      venue: { name: string; addressLine1: string } | null;
    };
    id: string;
    items: Array<{
      ticketType: { name: string };
      tickets: Array<{ id: string; ticketNumber: string; checkedInAt: Date | null }>;
    }>;
  }>,
) {
  return orders.flatMap((order) =>
    order.items.flatMap((item) =>
      item.tickets.map((ticket) => ({
        id: ticket.id,
        orderId: order.id,
        ticketNumber: ticket.ticketNumber,
        checkedInAt: ticket.checkedInAt,
        eventTitle: order.event.title,
        eventSlug: order.event.slug,
        eventStartAt: order.event.startAt,
        venueName: order.event.venue?.name ?? null,
        venueAddress: order.event.venue?.addressLine1 ?? null,
        ticketTypeName: item.ticketType.name,
      })),
    ),
  );
}

function splitTicketsByTime(tickets: TicketCard[]) {
  const now = Date.now();

  return {
    upcomingTickets: tickets
      .filter((ticket) => ticket.eventStartAt.getTime() >= now)
      .sort((a, b) => a.eventStartAt.getTime() - b.eventStartAt.getTime()),
    pastTickets: tickets
      .filter((ticket) => ticket.eventStartAt.getTime() < now)
      .sort((a, b) => b.eventStartAt.getTime() - a.eventStartAt.getTime()),
  };
}

async function loadAccountTickets() {
  try {
    const session = await requireAttendee();
    const profile = await prisma.attendeeProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!profile) {
      redirect("/auth/login");
    }

    const orders = await prisma.order.findMany({
      where: {
        attendeeUserId: profile.id,
        status: "PAID",
      },
      select: {
        id: true,
        event: {
          select: {
            title: true,
            slug: true,
            startAt: true,
            venue: { select: { name: true, addressLine1: true } },
          },
        },
        items: {
          select: {
            ticketType: { select: { name: true } },
            tickets: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                ticketNumber: true,
                checkedInAt: true,
              },
            },
          },
        },
      },
      orderBy: {
        event: {
          startAt: "asc",
        },
      },
    });

    const tickets = buildTicketCards(orders);
    return {
      tickets,
      ...splitTicketsByTime(tickets),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "UNAUTHENTICATED" || error.message === "FORBIDDEN")
    ) {
      redirect("/auth/login");
    }

    throw error;
  }
}

function TicketSection({
  title,
  subtitle,
  tickets,
}: {
  title: string;
  subtitle: string;
  tickets: TicketCard[];
}) {
  if (tickets.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="mt-2 text-sm text-neutral-500">{subtitle}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {tickets.map((ticket) => (
          <article
            key={ticket.id}
            className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-neutral-900">{ticket.eventTitle}</h3>
                <p className="text-sm text-neutral-600">{ticket.ticketTypeName}</p>
                <p className="font-mono text-xs text-neutral-500">{ticket.ticketNumber}</p>
              </div>
              {ticket.checkedInAt ? (
                <Badge className="border-transparent bg-emerald-100 text-emerald-700">
                  Checked in
                </Badge>
              ) : (
                <Badge className="border-transparent bg-neutral-100 text-neutral-600">
                  Ready to scan
                </Badge>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-600">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-[var(--theme-accent)]" />
                {formatDateTime(ticket.eventStartAt)}
              </span>
              {ticket.venueName && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[var(--theme-accent)]" />
                  {ticket.venueName}
                </span>
              )}
            </div>

            {ticket.venueAddress && (
              <p className="mt-2 text-sm text-neutral-500">{ticket.venueAddress}</p>
            )}

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.04)] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/account/tickets/${ticket.id}/qr`}
                  alt={`QR code for ${ticket.ticketNumber}`}
                  width={180}
                  height={180}
                  className="rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href={`/api/account/tickets/${ticket.id}/qr`}
                  download={`ticket-${ticket.ticketNumber}.png`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </a>
                <a
                  href={`/api/account/tickets/${ticket.id}/pdf`}
                  download={`ticket-${ticket.ticketNumber}.pdf`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
                >
                  <FileText className="h-4 w-4" />
                  Download PDF
                </a>
                <ResendConfirmationButton orderId={ticket.orderId} />
                <Link
                  href={`/events/${ticket.eventSlug}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--theme-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                >
                  <QrCode className="h-4 w-4" />
                  View event
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function AccountTicketsPage() {
  const { tickets, upcomingTickets, pastTickets } = await loadAccountTickets();

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">My Tickets</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Access every QR ticket from your paid orders, grouped by upcoming and past events.
        </p>
      </section>

      {tickets.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">No tickets yet</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Once you complete a purchase, your ticket QR codes will appear here.
          </p>
          <Link
            href="/events"
            className="mt-4 inline-flex rounded-xl bg-[var(--theme-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Browse events
          </Link>
        </section>
      ) : (
        <>
          <TicketSection
            title="Upcoming Events"
            subtitle="Show these QR codes at the door for your next events."
            tickets={upcomingTickets}
          />
          <TicketSection
            title="Past Events"
            subtitle="Your previous ticket history stays here for reference."
            tickets={pastTickets}
          />
        </>
      )}
    </div>
  );
}
