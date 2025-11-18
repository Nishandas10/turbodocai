import type { MetadataRoute } from "next";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://blumenote.com"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/start",
          "/signup",
          "/contact",
          "/privacy-policy",
          "/terms-conditions",
        ],
        disallow: [
          "/dashboard",
          "/settings",
          "/notes",
          "/notes/*",
          "/spaces",
          "/spaces/*",
          "/api",
          "/api/*",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
