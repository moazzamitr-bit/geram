/**
 * Admin sections that stay in the repo but are off for the closed beta.
 * Delete a path from this list to show it in the nav and serve the page again.
 * Metal stock registration stays on /admin/approvals (not in this list).
 */
export const CLOSED_BETA_INACTIVE_ADMIN_ROUTES = [
  "/admin/incidents",
  "/admin/bank-accounts",
  "/admin/sessions",
  "/admin/security",
  "/admin/withdrawals",
  "/admin/transactions",
  "/admin/cash",
  "/admin/reconciliation",
  "/admin/treasury",
  "/admin/inventory",
  "/admin/custody",
  "/admin/goals",
  "/admin/dca",
  "/admin/alerts",
  "/admin/plus",
  "/admin/notifications",
  "/admin/procurement",
] as const;

export type ClosedBetaInactiveAdminRoute = (typeof CLOSED_BETA_INACTIVE_ADMIN_ROUTES)[number];

export const CLOSED_BETA_INACTIVE_NOTICE_PATH = "/admin/beta-inactive";

function normalizeAdminPath(pathname: string) {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

export function isClosedBetaInactiveAdminPath(pathname: string) {
  const path = normalizeAdminPath(pathname);
  return CLOSED_BETA_INACTIVE_ADMIN_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
}

/** Rewrite target for a hidden admin URL, or null when the page stays live. */
export function closedBetaAdminRewrite(pathname: string): string | null {
  const path = normalizeAdminPath(pathname);
  if (!path.startsWith("/admin")) return null;
  if (path === "/admin/login" || path.startsWith("/admin/login/")) return null;
  if (path === CLOSED_BETA_INACTIVE_NOTICE_PATH) return null;
  if (!isClosedBetaInactiveAdminPath(path)) return null;
  return CLOSED_BETA_INACTIVE_NOTICE_PATH;
}
