import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { walletCreditRefId } from "@/lib/admin/wallet-credit";
import {
  formatUgAsGrams,
  ledgerCoversToman,
  payloadFromView,
  projectHolderLedger,
  sumCustomerLedger,
  type LedgerBalanceRow,
} from "@/lib/ledger/display";
import { tomanToIrr, UG_PER_GRAM } from "@/lib/core/money";
import { makeMemoryCore } from "../core/helpers";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function row(
  holderId: string,
  accountCode: string,
  asset: string,
  balance: bigint
): LedgerBalanceRow {
  return { holderId, accountCode, asset, balance };
}

describe("ledger balance projection", () => {
  it("shows a 50M toman USER_AVAILABLE credit in both panels", async () => {
    const { core, store } = makeMemoryCore({ seed: false });
    await core.creditApprovedUserIrr({
      userId: USER,
      amountIrr: tomanToIrr(50_000_000),
      reason: "closed beta invite credit",
      refId: walletCreditRefId("panel-credit"),
    });

    const rows = (await store.listAllAccounts()).map((account) =>
      row(account.holderId, account.accountCode, account.asset, account.balance)
    );
    const admin = projectHolderLedger(USER, rows);
    const userPanel = payloadFromView(admin);

    expect(admin.availableIrr).toBe(500_000_000n);
    expect(admin.availableToman).toBe(50_000_000);
    expect(admin.reservedToman).toBe(0);
    expect(userPanel.ui.rialAvailable).toBe(50_000_000);
    expect(userPanel.ui.rialPending).toBe(0);
    expect(userPanel.balances.irr.availableRial).toBe("500000000");
    expect(userPanel.balances.irr.availableToman).toBe(userPanel.ui.rialAvailable);
    expect(projectHolderLedger(OTHER, rows).availableToman).toBe(0);
    expect(sumCustomerLedger(rows)?.availableToman).toBe(50_000_000);
  });

  it("keeps available and reserved metal in micrograms, and toman as rial/10", () => {
    const rows = [
      row(USER, "USER_AVAILABLE", "IRR", 500_000_000n),
      row(USER, "USER_RESERVED", "IRR", 20_000n),
      row(USER, "USER_AVAILABLE", "GOLD", UG_PER_GRAM + UG_PER_GRAM / 2n),
      row(USER, "USER_RESERVED", "GOLD", UG_PER_GRAM / 2n),
      row(USER, "USER_AVAILABLE", "SILVER", 2n * UG_PER_GRAM),
      row(USER, "USER_RESERVED", "SILVER", 0n),
      row(USER, "USER_AVAILABLE", "COPPER", 250_000n),
      row(USER, "USER_RESERVED", "COPPER", 1_000n),
      row(USER, "PLATFORM_AVAILABLE", "GOLD", 9_000_000n),
    ];
    const view = projectHolderLedger(USER, rows);
    const panel = payloadFromView(view).ui;

    expect(view.availableToman).toBe(50_000_000);
    expect(view.reservedToman).toBe(2_000);
    expect(view.metals.GOLD.availableUg).toBe(1_500_000n);
    expect(view.metals.GOLD.availableMg).toBe(1_500);
    expect(view.metals.GOLD.reservedMg).toBe(500);
    expect(view.metals.SILVER.availableMg).toBe(2_000);
    expect(view.metals.COPPER.availableMg).toBe(250);
    expect(view.metals.COPPER.reservedMg).toBe(1);
    expect(panel.rialAvailable).toBe(50_000_000);
    expect(panel.rialPending).toBe(2_000);
    expect(panel.goldMg).toBe(1_500);
    expect(panel.silverMg).toBe(2_000);
    expect(panel.copperMg).toBe(250);
    expect(formatUgAsGrams(view.metals.GOLD.availableUg)).toContain("گرم");
    expect(ledgerCoversToman(view.availableIrr, 50_000_000)).toBe(true);
    expect(ledgerCoversToman(view.availableIrr, 50_000_001)).toBe(false);
  });
});

describe("balance screens do not read the legacy wallets table", () => {
  const root = process.cwd();
  const files = [
    "app/admin/(dashboard)/users/[id]/page.tsx",
    "app/admin/(dashboard)/wallets/page.tsx",
    "app/admin/(dashboard)/ledger/page.tsx",
    "app/api/me/balances/route.ts",
    "app/api/core/quotes/route.ts",
    "app/api/core/trades/route.ts",
    "lib/app/app-data.tsx",
    "lib/app/user-data.ts",
    "lib/commerce/cron-jobs.ts",
    "lib/core/engine.ts",
    "lib/admin/ops.ts",
    "lib/db/admin-queries.ts",
  ];

  it("uses the ledger for displayed balances and fund checks", () => {
    for (const file of files) {
      const src = readFileSync(path.join(root, file), "utf8");
      expect(src, file).not.toContain("toman_available");
      expect(src, file).not.toContain('from("wallets")');
      expect(src, file).not.toContain("from('wallets')");
    }

    const userPage = readFileSync(
      path.join(root, "app/admin/(dashboard)/users/[id]/page.tsx"),
      "utf8"
    );
    expect(userPage).toContain("readHolderLedgerView");
    expect(userPage).toContain("USER_AVAILABLE");

    const store = readFileSync(path.join(root, "lib/app/app-data.tsx"), "utf8");
    expect(store).toContain("/api/me/balances");
    expect(store).not.toContain("databaseBacked");

    const route = readFileSync(path.join(root, "app/api/me/balances/route.ts"), "utf8");
    expect(route).toContain("requireCoreUserId");
    expect(route).not.toContain("searchParams");

    const engine = readFileSync(path.join(root, "lib/core/engine.ts"), "utf8");
    expect(engine).toContain('getBalance(this.deps.store, input.userId, "USER_AVAILABLE", "IRR")');
    expect(engine).toContain('requireBalance(');
    expect(engine).toContain('"USER_AVAILABLE"');
  });
});
