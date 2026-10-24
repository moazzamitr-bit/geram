import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from "serwist";
import type { PrecacheEntry } from "serwist";
import {
  isBypassedRequest,
  isPageNavigation,
  isStaticAssetPath,
  shouldStorePage,
} from "@/lib/pwa/cache-policy";

/**
 * /api and /sb must not be intercepted. A NetworkOnly route still calls
 * respondWith, so auth and the Supabase proxy would depend on this worker.
 * Stopping the fetch event before Serwist sees it leaves those requests on
 * the browser's own network path, and no runtime rule stores them.
 */
const workerScope = self as unknown as {
  addEventListener: (
    type: "fetch",
    listener: (event: { request: { url: string }; stopImmediatePropagation: () => void }) => void
  ) => void;
};
workerScope.addEventListener("fetch", (event) => {
  let url: URL;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (isBypassedRequest(url)) event.stopImmediatePropagation();
});

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
 * /api and /sb match no runtime route. There is no rule that stores JSON APIs,
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
