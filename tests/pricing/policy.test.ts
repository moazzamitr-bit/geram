import { describe, expect, it } from "vitest";
import { goldBaseKeys, sidePricesToman, spreadFor, toBps, setPricingSettings, currentSettings } from "@/lib/pricing/policy";
import { DEFAULT_COMMERCE_SETTINGS, type CommerceSettings } from "@/lib/commerce/types";
import { parseCommerceSettings, mergeWithDefaults } from "@/lib/commerce/save-settings";
import { feesFromCommercePercent } from "@/lib/core/engine";
import { staticPriceFeed, type PriceFeed } from "@/lib/core/price";
import { withPriceGuard, type HaltInfo } from "@/lib/core/price-guard";
import { tomanToIrr } from "@/lib/core/money";
import { makeMemoryCore, TEST_PRICES } from "../core/helpers";

const S: CommerceSettings = DEFAULT_COMMERCE_SETTINGS;
const fees025 = feesFromCommercePercent({ plus: false, ...S.fees });

describe("pricing policy", () => {
  it("approved defaults: irg18 base, ±0.3% spread, 0.25% fee", () => {
    expect(S.pricing).toEqual({ goldBase: "tgju_gold_irg18", goldBuySpreadPercent: 0.003, goldSellSpreadPercent: 0.003 });
    expect(fees025.buyFeeBps).toBe(25n);
    expect(fees025.sellFeeBps).toBe(25n);
    expect(feesFromCommercePercent({ plus: true, ...S.fees }).buyFeeBps).toBe(25n);
  });

  it("buy/sell math on the live irg18 base (floor, toman)", () => {
    const { buyToman, sellToman } = sidePricesToman("gold18", 26_024_100, S);
    expect(buyToman).toBe(26_102_172); // 26,024,100 × 1.003 = 26,102,172.3 → floor
    expect(sellToman).toBe(25_946_027); // 26,024,100 × 0.997 = 25,946,027.7 → floor
    expect(sidePricesToman("GOLD", 0, S)).toEqual({ buyToman: 0, sellToman: 0 });
  });

  it("silver and copper are unchanged (zero spread)", () => {
    expect(sidePricesToman("silver925", 495_110, S)).toEqual({ buyToman: 495_110, sellToman: 495_110 });
    expect(sidePricesToman("copper", 3_896, S)).toEqual({ buyToman: 3_896, sellToman: 3_896 });
    expect(spreadFor("SILVER", S)).toEqual({ buySpreadBps: 0n, sellSpreadBps: 0n });
    expect(spreadFor("COPPER", S)).toEqual({ buySpreadBps: 0n, sellSpreadBps: 0n });
    expect(spreadFor("GOLD", S)).toEqual({ buySpreadBps: 30n, sellSpreadBps: 30n });
  });

  it("bounds: out-of-range spread is ignored, schema rejects >2%", () => {
    expect(toBps(0.021)).toBe(0n);
    expect(toBps(-0.001)).toBe(0n);
    expect(toBps(0.02)).toBe(200n);
    expect(() => parseCommerceSettings(mergeWithDefaults({ pricing: { ...S.pricing, goldBuySpreadPercent: 0.03 } }))).toThrow();
    expect(() => parseCommerceSettings(mergeWithDefaults({ fees: { ...S.fees, buyFeePercentFree: 0.025 } }))).toThrow();
    expect(() => parseCommerceSettings(mergeWithDefaults({ pricing: { ...S.pricing, goldBase: "geram18_buy" as never } }))).toThrow();
    expect(parseCommerceSettings(mergeWithDefaults({})).pricing).toEqual(S.pricing);
  });

  it("partial admin save keeps previous values", () => {
    const prev = { ...S, pricing: { ...S.pricing, goldBuySpreadPercent: 0.004 } };
    expect(mergeWithDefaults({ fees: S.fees }, prev).pricing.goldBuySpreadPercent).toBe(0.004);
  });

  it("base key order follows the setting; 2018 geram18_buy never used", () => {
    expect(goldBaseKeys("tgju_gold_irg18")).toEqual(["tgju_gold_irg18", "geram18"]);
    expect(goldBaseKeys("geram18")).toEqual(["geram18", "tgju_gold_irg18"]);
    expect(goldBaseKeys("geram18")).not.toContain("geram18_buy");
  });
});

describe("engine: spread after guards, fee from settings", () => {
  const prev = currentSettings();
  const core = () =>
    makeMemoryCore({ fees: fees025, spread: (a) => spreadFor(a, S) }).core;

  it("gold buy quote = base×1.003, fee 0.25%, reference stays raw", async () => {
    const c = core();
    await c.sandboxDeposit("u1", tomanToIrr(50_000_000), "d1");
    const q = await c.issueQuote({ userId: "u1", asset: "GOLD", side: "BUY", inputMode: "RIAL_AMOUNT", requestedIrr: tomanToIrr(1_000_000) });
    expect(q.referencePriceIrrPerGram).toBe(TEST_PRICES.GOLD);
    expect(q.executionPriceIrrPerGram).toBe((TEST_PRICES.GOLD * 10_030n) / 10_000n);
    expect(q.feeIrr).toBe((tomanToIrr(1_000_000) * 25n) / 10_000n);
    const s = await c.previewQuote({ asset: "GOLD", side: "SELL", inputMode: "METAL_WEIGHT", requestedWeightUg: 1_000_000n });
    expect(s.executionPriceIrrPerGram).toBe(TEST_PRICES.GOLD - (TEST_PRICES.GOLD * 30n) / 10_000n);
  });

  it("silver quote has no spread", async () => {
    const c = core();
    await c.sandboxDeposit("u2", tomanToIrr(50_000_000), "d2");
    const q = await c.issueQuote({ userId: "u2", asset: "SILVER", side: "BUY", inputMode: "RIAL_AMOUNT", requestedIrr: tomanToIrr(1_000_000) });
    expect(q.executionPriceIrrPerGram).toBe(TEST_PRICES.SILVER);
  });

  it("1% execution recheck still compares raw base (0.3% spread does not trip it)", async () => {
    let gold = TEST_PRICES.GOLD;
    const prices: PriceFeed = { getExecutable: (a) => staticPriceFeed({ ...TEST_PRICES, GOLD: gold }).getExecutable(a) };
    const { core: c } = makeMemoryCore({ prices, fees: fees025, spread: (a) => spreadFor(a, S) });
    await c.sandboxDeposit("u3", tomanToIrr(50_000_000), "d3");
    const q = await c.issueQuote({ userId: "u3", asset: "GOLD", side: "BUY", inputMode: "RIAL_AMOUNT", requestedIrr: tomanToIrr(1_000_000) });
    gold = (TEST_PRICES.GOLD * 98n) / 100n;
    await expect(c.executeTrade({ userId: "u3", quoteId: q.id, idempotencyKey: "k1" })).rejects.toMatchObject({ code: "price_moved" });
    gold = TEST_PRICES.GOLD;
    await expect(c.executeTrade({ userId: "u3", quoteId: q.id, idempotencyKey: "k2" })).resolves.toMatchObject({ status: "SETTLED" });
  });

  it("price guard still rejects out-of-band raw base before any spread", async () => {
    const halts: HaltInfo[] = [];
    const bad: PriceFeed = { getExecutable: (a) => staticPriceFeed({ ...TEST_PRICES, GOLD: 26_118_500n }).getExecutable(a) };
    const g = withPriceGuard(bad, { onHalt: async (h) => void halts.push(h) });
    const { core: c } = makeMemoryCore({ prices: g, fees: fees025, spread: (a) => spreadFor(a, S) });
    await c.sandboxDeposit("u4", tomanToIrr(50_000_000), "d4");
    await expect(
      c.issueQuote({ userId: "u4", asset: "GOLD", side: "BUY", inputMode: "RIAL_AMOUNT", requestedIrr: tomanToIrr(1_000_000) })
    ).rejects.toMatchObject({ code: "price_guard" });
    expect(halts[0]).toMatchObject({ reason: "out_of_band" });
  });

  it("setPricingSettings applies instantly", () => {
    setPricingSettings({ ...S, pricing: { ...S.pricing, goldBuySpreadPercent: 0.005 } });
    expect(spreadFor("GOLD").buySpreadBps).toBe(50n);
    setPricingSettings(prev);
  });
});
