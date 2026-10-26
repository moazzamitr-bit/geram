import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://geram.co";

/** Only public, existing pages. Add /privacy and /terms once their text is final. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/auth/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
