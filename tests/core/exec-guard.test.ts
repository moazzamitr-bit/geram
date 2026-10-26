import { describe, expect, it } from "vitest";
import type { PriceFeed } from "@/lib/core/price";
import { staticPriceFeed } from "@/lib/core/price";
import { tomanToIrr } from "@/lib/core/money";
import { MemoryCoreStore } from "@/lib/core/store";
import { makeMemoryCore, TEST_PRICES } from "./helpers";

describe("execution-time guards", () => {
  it("rejects execution when the server price moved >1% since the quote", async () => {
    let gold = TEST_PRICES.GOLD;
    const prices: PriceFeed = { getExecutable: (a) => staticPriceFeed({ ...TEST_PRICES, GOLD: gold }).getExecutable(a) };
    const { core } = makeMemoryCore({ prices });
    await core.sandboxDeposit("u1", tomanToIrr(50_000_000), "d1");
    const q = await core.issueQuote({ userId: "u1", asset: "GOLD", side: "BUY", inputMode: "RIAL_AMOUNT", requestedIrr: tomanToIrr(1_000_000) });
    gold = (TEST_PRICES.GOLD * 90n) / 100n; // the price dropped 10x-style / big move
    await expect(core.executeTrade({ userId: "u1", quoteId: q.id, idempotencyKey: "k1" })).rejects.toMatchObject({ code: "price_moved" });
    gold = TEST_PRICES.GOLD;
    await expect(core.executeTrade({ userId: "u1", quoteId: q.id, idempotencyKey: "k2" })).resolves.toMatchObject({ status: "SETTLED" });
  });

  it("enforces per-order max", async () => {
    const { core } = makeMemoryCore();
    await core.sandboxDeposit("u2", tomanToIrr(900_000_000), "d2");
    await expect(
      core.issueQuote({ userId: "u2", asset: "GOLD", side: "BUY", inputMode: "RIAL_AMOUNT", requestedIrr: tomanToIrr(600_000_000) })
    ).rejects.toMatchObject({ code: "trade_limit" });
  });

  it("platform hourly net-buy cap auto-halts the asset", async () => {
    const store = new MemoryCoreStore() as MemoryCoreStore & { platformNetBuyIrrSince?: (s: string) => Promise<bigint> };
    store.platformNetBuyIrrSince = async () => tomanToIrr(4_999_500_000);
    const { core } = makeMemoryCore({ store });
    await core.sandboxDeposit("u3", tomanToIrr(50_000_000), "d3");
    await expect(
      core.issueQuote({ userId: "u3", asset: "GOLD", side: "BUY", inputMode: "RIAL_AMOUNT", requestedIrr: tomanToIrr(1_000_000) })
    ).rejects.toMatchObject({ code: "kill_switch" });
    expect((await store.listKillSwitches()).GOLD_BUY_ENABLED).toBe(false);
  });
});
