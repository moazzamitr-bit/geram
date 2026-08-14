import { describe, expect, it } from "vitest";
import { FinancialCore } from "@/lib/core/engine";
import { MemoryCoreStore } from "@/lib/core/store";
import { staticPriceFeed } from "@/lib/core/price";
import { tomanToIrr, UG_PER_GRAM } from "@/lib/core/money";
import { DEFAULT_FEE_SNAPSHOT } from "@/lib/core/fees";

function makeCore() {
  return new FinancialCore({
    store: new MemoryCoreStore(),
    prices: staticPriceFeed({
      GOLD: tomanToIrr(7_000_000),
      SILVER: tomanToIrr(400_000),
      COPPER: tomanToIrr(2_500),
      TEST_METAL: tomanToIrr(10_000),
    }),
    mode: "SANDBOX",
    fees: { ...DEFAULT_FEE_SNAPSHOT, buyFeeMinIrr: 0n, sellFeeMinIrr: 0n },
    seedInventoryUg: {
      GOLD: UG_PER_GRAM * 10_000n,
      SILVER: UG_PER_GRAM * 10_000n,
      COPPER: UG_PER_GRAM * 10_000n,
      TEST_METAL: UG_PER_GRAM * 10_000n,
    },
  });
}

describe("concurrent trades", () => {
  it("serializes two buys so rial is not double-spent", async () => {
    const core = makeCore();
    const user = "conc-user";
    await core.sandboxDeposit(user, tomanToIrr(1_000_000), "d");
    const q1 = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(1_000_000),
    });
    const q2 = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(1_000_000),
    });
    const results = await Promise.allSettled([
      core.executeTrade({ userId: user, quoteId: q1.id, idempotencyKey: "a" }),
      core.executeTrade({ userId: user, quoteId: q2.id, idempotencyKey: "b" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected");
    expect(ok.length).toBe(1);
    expect(fail.length).toBe(1);
    const w = await core.wallet(user);
    expect(w.rialAvailable).toBe(0n);
  });
});
