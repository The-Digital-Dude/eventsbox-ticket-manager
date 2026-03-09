import type { MetadataRoute } from "next";
import { env } from "@/src/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/organizer/", "/account/", "/api/"],
      },
    ],
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
