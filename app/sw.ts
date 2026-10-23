import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";
import type { PrecacheEntry } from "serwist";
import {
  isBypassedRequest,
  isPageNavigation,
  isStaticAssetPath,
  shouldStorePage,
} from "@/lib/pwa/cache-policy";

const pagesCache = {
  cacheWillUpdate: async ({ response }: { response?: Response }) => {
    if (!response) return null;
    if (
      !shouldStorePage({
        status: response.status,
        redirected: response.redirected,
        url: response.url,
        contentType: response.headers.get("content-type"),
      })
    ) {
      return null;
    }
    return response;
  },
};

/**
 * Precache is the app shell (build assets + public icons/fonts/offline page).
 * /api and /sb are NetworkOnly. There is no runtime rule that stores JSON APIs,
 * so a quote, wallet, or auth response cannot be replayed offline.
 */
const serwist = new Serwist({
  // Injection point must stay written as self.__SW_MANIFEST so the build can replace it.
  precacheEntries: (self as unknown as { __SW_MANIFEST?: (PrecacheEntry | string)[] }).__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ url }) => isBypassedRequest(url),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && !isBypassedRequest(url) && isStaticAssetPath(url.pathname),
      handler: new CacheFirst({
        cacheName: "geram-static",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    {
      matcher: ({ request, url, sameOrigin }) => sameOrigin && isPageNavigation(request, url),
      handler: new NetworkFirst({
        cacheName: "geram-pages",
        plugins: [
          pagesCache,
          new ExpirationPlugin({
            maxEntries: 24,
            maxAgeSeconds: 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher({ request }) {
          return request.mode === "navigate" || request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
