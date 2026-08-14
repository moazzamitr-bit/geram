import { describe, expect, it } from "vitest";
import { FinancialCore } from "@/lib/core/engine";
import { MemoryCoreStore } from "@/lib/core/store";
import { staticPriceFeed } from "@/lib/core/price";
import { tomanToIrr, gramsToUg, UG_PER_GRAM } from "@/lib/core/money";
import { DEFAULT_FEE_SNAPSHOT } from "@/lib/core/fees";
import type { AssetCode } from "@/lib/core/assets";
import { CoreError } from "@/lib/core/types";

const ASSETS: AssetCode[] = ["GOLD", "SILVER", "COPPER", "TEST_METAL"];

function makeCore(opts?: { now?: () => Date; inventory?: bigint }) {
  const store = new MemoryCoreStore();
  const core = new FinancialCore({
    store,
    prices: staticPriceFeed({
      GOLD: tomanToIrr(7_000_000),
      SILVER: tomanToIrr(400_000),
      COPPER: tomanToIrr(2_500),
      TEST_METAL: tomanToIrr(10_000),
    }),
    mode: "SANDBOX",
    fees: {
      ...DEFAULT_FEE_SNAPSHOT,
      buyFeeMinIrr: 0n,
      sellFeeMinIrr: 0n,
      buyFeeBps: 70n,
      sellFeeBps: 50n,
    },
    now: opts?.now,
    seedInventoryUg: {
      GOLD: opts?.inventory ?? UG_PER_GRAM * 1_000n,
      SILVER: opts?.inventory ?? UG_PER_GRAM * 1_000n,
      COPPER: opts?.inventory ?? UG_PER_GRAM * 10_000n,
      TEST_METAL: opts?.inventory ?? UG_PER_GRAM * 1_000n,
    },
  });
  return { store, core };
}

describe.each(ASSETS)("wallet-funded buy/sell %s", (asset) => {
  it("deposits, buys, sells through the ledger", async () => {
    const { core } = makeCore();
    const user = `user-${asset}`;
    await core.sandboxDeposit(user, tomanToIrr(50_000_000), "dep-1");
    const before = await core.wallet(user);
    expect(before.rialAvailable).toBe(tomanToIrr(50_000_000));

    const buyQuote = await core.issueQuote({
      userId: user,
      asset,
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(5_000_000),
    });
    expect(buyQuote.status).toBe("ACTIVE");
    expect(buyQuote.weightUg > 0n).toBe(true);

    const buy = await core.executeTrade({
      userId: user,
      quoteId: buyQuote.id,
      idempotencyKey: "buy-1",
    });
    expect(buy.status).toBe("SETTLED");

    const mid = await core.wallet(user);
    expect(mid.metals[asset].availableUg).toBe(buyQuote.weightUg);
    expect(mid.rialAvailable).toBe(tomanToIrr(50_000_000) - buyQuote.grossIrr);

    const sellQuote = await core.issueQuote({
      userId: user,
      asset,
      side: "SELL",
      inputMode: "METAL_WEIGHT",
      requestedWeightUg: buyQuote.weightUg,
    });
    const sell = await core.executeTrade({
      userId: user,
      quoteId: sellQuote.id,
      idempotencyKey: "sell-1",
    });
    expect(sell.status).toBe("SETTLED");
    const after = await core.wallet(user);
    expect(after.metals[asset].availableUg).toBe(0n);
  });
});

describe("idempotency", () => {
  it("executes a duplicate trade key once", async () => {
    const { core } = makeCore();
    const user = "idem-user";
    await core.sandboxDeposit(user, tomanToIrr(20_000_000), "d");
    const q = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(2_000_000),
    });
    const a = await core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "same" });
    const b = await core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "same" });
    expect(a.id).toBe(b.id);
    const w = await core.wallet(user);
    expect(w.metals.GOLD.availableUg).toBe(q.weightUg);
  });
});

describe("double spend / oversell", () => {
  it("rejects a second spend of the same rial", async () => {
    const { core } = makeCore();
    const user = "ds-user";
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
    await core.executeTrade({ userId: user, quoteId: q1.id, idempotencyKey: "t1" });
    await expect(
      core.executeTrade({ userId: user, quoteId: q2.id, idempotencyKey: "t2" })
    ).rejects.toBeInstanceOf(CoreError);
  });

  it("does not oversell inventory", async () => {
    const { core } = makeCore({ inventory: gramsToUg(1n) });
    const user = "inv-user";
    await core.sandboxDeposit(user, tomanToIrr(100_000_000), "d");
    await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "METAL_WEIGHT",
      requestedWeightUg: gramsToUg(1n),
    });
    await expect(
      core.issueQuote({
        userId: user,
        asset: "GOLD",
        side: "BUY",
        inputMode: "METAL_WEIGHT",
        requestedWeightUg: gramsToUg(1n),
      })
    ).rejects.toBeInstanceOf(CoreError);
  });

  it("isolates gold inventory from silver", async () => {
    const { core } = makeCore({ inventory: gramsToUg(1n) });
    const user = "iso-user";
    await core.sandboxDeposit(user, tomanToIrr(100_000_000), "d");
    await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "METAL_WEIGHT",
      requestedWeightUg: gramsToUg(1n),
    });
    const silver = await core.issueQuote({
      userId: user,
      asset: "SILVER",
      side: "BUY",
      inputMode: "METAL_WEIGHT",
      requestedWeightUg: gramsToUg(1n),
    });
    expect(silver.asset).toBe("SILVER");
  });
});

describe("quote expiry race", () => {
  it("expiry and execute have one winner", async () => {
    let t = new Date("2026-01-01T00:00:00Z");
    const { core } = makeCore({ now: () => t });
    const user = "exp-user";
    await core.sandboxDeposit(user, tomanToIrr(10_000_000), "d");
    const q = await core.issueQuote({
      userId: user,
      asset: "TEST_METAL",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(100_000),
    });
    t = new Date(t.getTime() + 10_000);
    const [exp, exec] = await Promise.allSettled([
      core.expireQuoteIfNeeded(q),
      core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "race" }),
    ]);
    const expired = exp.status === "fulfilled" && exp.value.status === "EXPIRED";
    const settled = exec.status === "fulfilled" && exec.value.status === "SETTLED";
    expect(expired !== settled || settled).toBe(true);
    expect(Number(expired) + Number(settled)).toBe(1);
  });
});

describe("sandbox deposit isolation", () => {
  it("blocks sandbox deposit in PRODUCTION", async () => {
    const store = new MemoryCoreStore();
    const core = new FinancialCore({
      store,
      prices: staticPriceFeed({ GOLD: 1n, SILVER: 1n, COPPER: 1n, TEST_METAL: 1n }),
      mode: "PRODUCTION",
    });
    await expect(core.sandboxDeposit("u", 100n, "k")).rejects.toBeInstanceOf(CoreError);
  });
});

describe("outbox", () => {
  it("records quote and trade events in the same flow", async () => {
    const { core, store } = makeCore();
    const user = "obx-user";
    await core.sandboxDeposit(user, tomanToIrr(5_000_000), "d");
    const q = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(1_000_000),
    });
    await core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "k" });
    const pending = await store.listPendingOutbox(20);
    expect(pending.some((e) => e.topic === "quote.issued")).toBe(true);
    expect(pending.some((e) => e.topic === "trade.settled")).toBe(true);
    await core.processOutbox(async () => undefined);
    expect((await store.listPendingOutbox(20)).length).toBe(0);
  });
});
