import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeReleaseReadiness } from "@/lib/admin/readiness";

describe("admin readiness copy", () => {
  it("uses probed tables, Finnotech, and live quote freshness", () => {
    const sections = computeReleaseReadiness({
      tables: {
        core_ledger_accounts: true,
        core_journals: true,
        core_trades: true,
        core_quotes: true,
        market_prices: true,
        core_outbox: true,
      },
      finnotech: true,
      prices: [
        { instrument: "gold18", stale: false },
        { instrument: "silver925", stale: false },
        { instrument: "copper", stale: true },
      ],
    });
    const text = JSON.stringify(sections);
    expect(text).not.toContain("CORE_MILESTONE_PLACEHOLDER");
    expect(text).not.toContain("جدول‌های financial core");
    expect(text).not.toContain("فروشنده KYC");
    expect(text).not.toContain("sandbox");
    expect(sections.find((section) => section.id === "KYC")?.status).toBe("READY");
    expect(sections.find((section) => section.id === "TREASURY")?.status).toBe("DEGRADED");
    expect(sections.find((section) => section.id === "MARKET_DATA")?.blockers.join(" ")).toContain("مس");
    expect(sections.find((section) => section.id === "PAYMENTS")?.blockers.join(" ")).toContain("PSP");
  });

  it("says Finnotech is unconfigured when the credentials are absent", () => {
    const kyc = computeReleaseReadiness({ finnotech: false }).find((section) => section.id === "KYC");
    expect(kyc?.status).toBe("NOT_READY");
    expect(kyc?.blockers.join(" ")).toContain("Finnotech تنظیم نشده");
  });
});

describe("admin surfaces no longer read legacy transactions", () => {
  const root = process.cwd();
  const files = [
    "lib/admin/ops.ts",
    "lib/admin/queries.ts",
    "lib/db/admin-queries.ts",
    "lib/db/platform-sync.ts",
    "app/api/admin/export/route.ts",
  ];

  it("does not select the transactions or wallets tables", () => {
    for (const file of files) {
      const src = readFileSync(path.join(root, file), "utf8");
      expect(src, file).not.toContain('from("transactions")');
      expect(src, file).not.toContain('from("wallets")');
      expect(src, file).not.toContain("persistTransaction");
      expect(src, file).not.toContain("persistWallet");
    }
    const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
    expect(layout).toContain("metadataBase");
  });
});
