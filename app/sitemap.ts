import type { MetadataRoute } from "next";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publishedEvents = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: env.APP_URL, lastModified: new Date() },
    { url: `${env.APP_URL}/events`, lastModified: new Date() },
    { url: `${env.APP_URL}/auth/login`, lastModified: new Date() },
    { url: `${env.APP_URL}/auth/register`, lastModified: new Date() },
  ];

  const eventRoutes = publishedEvents.map((event) => ({
    url: `${env.APP_URL}/events/${event.slug}`,
    lastModified: event.updatedAt,
  }));

  return [...staticRoutes, ...eventRoutes];
}
