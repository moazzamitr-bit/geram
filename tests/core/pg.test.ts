import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { CORE_SCHEMA_SQL } from "@/lib/core/schema";
import { PostgresCoreStore } from "@/lib/core/pg-store";
import { FinancialCore } from "@/lib/core/engine";
import { staticPriceFeed } from "@/lib/core/price";
import { tomanToIrr, UG_PER_GRAM } from "@/lib/core/money";
import { DEFAULT_FEE_SNAPSHOT } from "@/lib/core/fees";

describe("PostgreSQL ledger integration (PGlite)", () => {
  it("persists buy/sell journals and balances", async () => {
    const db = new PGlite();
    await db.exec(CORE_SCHEMA_SQL);
    const store = new PostgresCoreStore({
      query: async (sql, params = []) => {
        const res = await db.query(sql, params);
        return { rows: res.rows as Record<string, unknown>[] };
      },
      exec: async (sql, params = []) => {
        await db.query(sql, params);
      },
    });
    const core = new FinancialCore({
      store,
      prices: staticPriceFeed({
        GOLD: tomanToIrr(7_000_000),
        SILVER: tomanToIrr(400_000),
        COPPER: tomanToIrr(2_500),
        TEST_METAL: tomanToIrr(10_000),
      }),
      mode: "SANDBOX",
      fees: { ...DEFAULT_FEE_SNAPSHOT, buyFeeMinIrr: 0n, sellFeeMinIrr: 0n },
      seedInventoryUg: {
        GOLD: UG_PER_GRAM * 100n,
        SILVER: UG_PER_GRAM * 100n,
        COPPER: UG_PER_GRAM * 100n,
        TEST_METAL: UG_PER_GRAM * 100n,
      },
    });
    const user = "pg-user";
    await core.sandboxDeposit(user, tomanToIrr(8_000_000), "dep");
    const q = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(2_000_000),
    });
    const trade = await core.executeTrade({
      userId: user,
      quoteId: q.id,
      idempotencyKey: "pg-buy",
    });
    expect(trade.status).toBe("SETTLED");
    const wallet = await core.wallet(user);
    expect(wallet.metals.GOLD.availableUg).toBe(q.weightUg);
    const { rows } = await db.query("select count(*)::int as n from core_journals");
    expect(Number((rows[0] as { n: number }).n)).toBeGreaterThan(1);
  });
});
