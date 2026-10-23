import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import path from "path";
import { shouldPrecacheAsset } from "./lib/pwa/cache-policy";

function keepShellPrecache<T extends { url: string }>(entries: T[]) {
  return entries.filter((entry) => shouldPrecacheAsset(entry.url));
}

// Dev stays on Turbopack (`next dev --turbopack`); Serwist compiles in the
// webpack production build only. `next build` does not pass --turbopack.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  // Next 15.5 no longer exposes the main-app webpack entry Serwist hooks.
  // components/pwa/RegisterServiceWorker.tsx registers /sw.js instead.
  register: false,
  cacheOnNavigation: false,
  reloadOnOnline: false,
  globPublicPatterns: [
    "offline.html",
    "manifest.webmanifest",
    "icons/icon-*.png",
    "icons/apple-touch-icon.png",
    "brand/favicon-32.png",
    "brand/logo-mark.webp",
    "images/hero-bg.webp",
  ],
  manifestTransforms: [
    async (entries) => ({
      manifest: keepShellPrecache(entries),
      warnings: [],
    }),
  ],
});

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Clickjacking protection for the money screens; a full script CSP needs
  // nonces for Next's inline runtime and is left for a dedicated pass.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker / any Node host (Vercel ignores it).
  output: "standalone",
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Optimized images are content-stable until the source file changes.
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    const staticAssetCache = [
      {
        key: "Cache-Control",
        value: "public, max-age=86400, stale-while-revalidate=604800",
      },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/images/:path*", headers: staticAssetCache },
      { source: "/brand/:path*", headers: staticAssetCache },
      { source: "/icons/:path*", headers: staticAssetCache },
      { source: "/splash/:path*", headers: staticAssetCache },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json; charset=utf-8" }],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/offline", destination: "/offline.html" }],
    };
  },
};

export default withSerwist(nextConfig);
