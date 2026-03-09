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
  return <EventDetailClient slug={slug} />;
}
