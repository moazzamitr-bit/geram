import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLOSED_BETA_INACTIVE_ADMIN_ROUTES,
  CLOSED_BETA_INACTIVE_NOTICE_PATH,
  closedBetaAdminRewrite,
  isClosedBetaInactiveAdminPath,
} from "@/lib/admin/closed-beta";
import { adminNav, adminNavCatalog, adminNavGroups } from "@/lib/admin/navigation";

const HIDDEN = [
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
  "/admin/referrals",
  "/admin/plus",
  "/admin/delivery",
  "/admin/notifications",
  "/admin/procurement",
];

const VISIBLE = [
  "/admin",
  "/admin/health",
  "/admin/readiness",
  "/admin/users",
  "/admin/kyc",
  "/admin/deposits",
  "/admin/approvals",
  "/admin/ledger",
  "/admin/trades",
  "/admin/quotes",
  "/admin/market",
  "/admin/settings",
  "/admin/switches",
  "/admin/flags",
  "/admin/providers",
  "/admin/audit",
  "/admin/admins",
  "/admin/system",
  "/admin/support",
];

describe("closed beta admin routes", () => {
  it("uses one list for the sections that are off", () => {
    expect([...CLOSED_BETA_INACTIVE_ADMIN_ROUTES]).toEqual(HIDDEN);
  });

  it("hides those sections from the nav and keeps the live ones", () => {
    const visible = new Set(adminNav.map((item) => item.href));
    for (const href of HIDDEN) expect(visible.has(href)).toBe(false);
    for (const href of VISIBLE) expect(visible.has(href)).toBe(true);
    expect(adminNavGroups.every((group) => group.items.length > 0)).toBe(true);
  });

  it("keeps the hidden pages in the catalog so they can be turned back on", () => {
    const catalog = new Set(adminNavCatalog.flatMap((group) => group.items.map((item) => item.href)));
    for (const href of HIDDEN) expect(catalog.has(href)).toBe(true);
    const page = readFileSync(
      path.join(process.cwd(), "app/admin/(dashboard)/inventory/page.tsx"),
      "utf8"
    );
    expect(page.length).toBeGreaterThan(100);
  });

  it("rewrites hidden routes, including detail pages, and leaves the live ones", () => {
    expect(isClosedBetaInactiveAdminPath("/admin/incidents/inc-1")).toBe(true);
    expect(closedBetaAdminRewrite("/admin/incidents/inc-1")).toBe(CLOSED_BETA_INACTIVE_NOTICE_PATH);
    expect(closedBetaAdminRewrite("/admin/kyc")).toBeNull();
    expect(closedBetaAdminRewrite("/admin/kyc/user-1")).toBeNull();
    expect(closedBetaAdminRewrite("/admin/treasury?asset=GOLD")).toBe(
      CLOSED_BETA_INACTIVE_NOTICE_PATH
    );
    expect(closedBetaAdminRewrite("/admin/approvals")).toBeNull();
    expect(closedBetaAdminRewrite("/admin/users/user-1")).toBeNull();
    expect(closedBetaAdminRewrite("/admin/wallets")).toBeNull();
    expect(closedBetaAdminRewrite("/admin/search")).toBeNull();
    expect(closedBetaAdminRewrite("/admin/login")).toBeNull();
    expect(closedBetaAdminRewrite("/admin/support/ticket-1")).toBeNull();
    expect(closedBetaAdminRewrite("/admin/trades/trade-1")).toBeNull();
    expect(closedBetaAdminRewrite(CLOSED_BETA_INACTIVE_NOTICE_PATH)).toBeNull();
    expect(isClosedBetaInactiveAdminPath("/admin")).toBe(false);
  });

  it("gates the routes from middleware with that same helper", () => {
    const middleware = readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
    expect(middleware).toContain("closedBetaAdminRewrite");
  });
});
