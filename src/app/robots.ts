import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      // Ahrefs, and the other SEO crawlers, need the full public surface.
      { userAgent: ["AhrefsBot", "AhrefsSiteAudit"], allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
