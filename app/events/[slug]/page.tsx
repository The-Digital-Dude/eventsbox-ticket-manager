import type { Metadata } from "next";
import { EventDetailClient } from "@/app/events/[slug]/EventDetailClient";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const DESCRIPTION_LIMIT = 160;
const DEFAULT_PAGE_DESCRIPTION = "Discover public events and book tickets on EventsBox.";
const FALLBACK_OG_IMAGE = `${env.APP_URL}/icon.png`;

function buildDescription(title: string, description: string | null) {
  const source =
    description?.replace(/\s+/g, " ").trim() || `Discover ${title} on EventsBox.`;

  if (source.length <= DESCRIPTION_LIMIT) {
    return source;
  }

  return `${source.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

async function getEventMetadataRecord(slug: string) {
  return prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      title: true,
      description: true,
      heroImage: true,
    },
  });
}

async function getEventJsonLdRecord(slug: string) {
  return prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      title: true,
      description: true,
      slug: true,
      heroImage: true,
      startAt: true,
      endAt: true,
      currency: true,
      ticketTypes: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        select: { price: true, quantity: true, sold: true, reservedQty: true },
        take: 1,
      },
      venue: {
        select: {
          name: true,
          addressLine1: true,
          lat: true,
          lng: true,
        },
      },
      city: { select: { name: true } },
      state: { select: { name: true } },
      country: { select: { name: true } },
      organizerProfile: {
        select: {
          companyName: true,
          brandName: true,
        },
      },
    },
  });
}

function buildEventJsonLd(event: Awaited<ReturnType<typeof getEventJsonLdRecord>>) {
  if (!event) return null;

  const lowestTicket = event.ticketTypes[0] ?? null;
  const remaining = lowestTicket
    ? Math.max(0, lowestTicket.quantity - lowestTicket.sold - lowestTicket.reservedQty)
    : 0;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: buildDescription(event.title, event.description),
    image: event.heroImage ? [event.heroImage] : undefined,
    startDate: event.startAt.toISOString(),
    endDate: event.endAt.toISOString(),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    url: `${env.APP_URL}/events/${event.slug}`,
    location: event.venue
      ? {
          "@type": "Place",
          name: event.venue.name,
          address: [event.venue.addressLine1, event.city?.name, event.state?.name, event.country?.name].filter(Boolean).join(", "),
          geo: event.venue.lat !== null && event.venue.lng !== null
            ? {
                "@type": "GeoCoordinates",
                latitude: event.venue.lat,
                longitude: event.venue.lng,
              }
            : undefined,
        }
      : undefined,
    organizer: {
      "@type": "Organization",
      name: event.organizerProfile.brandName ?? event.organizerProfile.companyName ?? "EventsBox Organizer",
    },
    offers: lowestTicket
      ? {
          "@type": "Offer",
          url: `${env.APP_URL}/events/${event.slug}`,
          price: Number(lowestTicket.price).toFixed(2),
          priceCurrency: event.currency,
          availability: remaining > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
          validFrom: new Date().toISOString(),
        }
      : undefined,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventMetadataRecord(slug);

  if (!event) {
    return {
      title: "Event Not Found | EventsBox",
      description: DEFAULT_PAGE_DESCRIPTION,
      openGraph: {
        title: "Event Not Found | EventsBox",
        description: DEFAULT_PAGE_DESCRIPTION,
        type: "website",
        images: [{ url: FALLBACK_OG_IMAGE }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Event Not Found | EventsBox",
        description: DEFAULT_PAGE_DESCRIPTION,
        images: [FALLBACK_OG_IMAGE],
      },
    };
  }

  const title = `${event.title} | EventsBox`;
  const description = buildDescription(event.title, event.description);
  const image = event.heroImage || FALLBACK_OG_IMAGE;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const jsonLd = buildEventJsonLd(await getEventJsonLdRecord(slug));

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <EventDetailClient slug={slug} />
    </>
  );
}
