/**
 * What the service worker is allowed to store.
 * Financial and auth responses must hit the network every time — a cached
 * quote or wallet payload would look like an offline trade.
 */

export function isBypassedRequest(url: URL): boolean {
  const path = url.pathname;
  if (path === "/api" || path.startsWith("/api/")) return true;
  if (path === "/sb" || path.startsWith("/sb/")) return true;
  // Supabase GoTrue, whether or not it is mounted under the /sb proxy.
  if (path.includes("/auth/v1/")) return true;
  return false;
}

export function isStaticAssetPath(pathname: string): boolean {
  return /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|ico|webp|avif)$/i.test(pathname);
}

export function isPageNavigation(
  request: { mode: string; destination: string },
  url: URL
): boolean {
  if (isBypassedRequest(url)) return false;
  return request.mode === "navigate" || request.destination === "document";
}

export function shouldStorePage(input: {
  status: number;
  redirected: boolean;
  url: string;
  contentType: string | null;
}): boolean {
  if (input.status !== 200 || input.redirected) return false;
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return false;
  }
  if (isBypassedRequest(parsed)) return false;
  const type = input.contentType ?? "";
  return type.includes("text/html");
}
