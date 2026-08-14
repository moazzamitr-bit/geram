import { describe, expect, it } from "vitest";
import {
  gramsToUg,
  irr,
  irrToTomanFloor,
  mulDivCeil,
  mulDivFloor,
  tomanToIrr,
  UG_PER_GRAM,
} from "@/lib/core/money";
import { computeQuote } from "@/lib/core/quote-math";
import { DEFAULT_FEE_SNAPSHOT } from "@/lib/core/fees";
import { copperIrrPerGram } from "@/lib/core/copper-price";
import { ASSET_SPECS, uiInstrumentToAsset } from "@/lib/core/assets";

describe("canonical units", () => {
  it("converts toman and grams without float in the core", () => {
    expect(tomanToIrr(500_000n)).toBe(5_000_000n);
    expect(irrToTomanFloor(5_000_001n)).toBe(500_000n);
    expect(gramsToUg(1n)).toBe(1_000_000n);
    expect(UG_PER_GRAM).toBe(1_000_000n);
  });

  it("rejects unsafe JS numbers for IRR", () => {
    expect(() => irr(1.5)).toThrow();
    expect(() => irr(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  it("mulDiv is integer-only", () => {
    expect(mulDivFloor(10n, 3n, 4n)).toBe(7n);
    expect(mulDivCeil(10n, 3n, 4n)).toBe(8n);
  });
});

describe("quote rounding", () => {
  const fees = { ...DEFAULT_FEE_SNAPSHOT, buyFeeMinIrr: 0n, sellFeeMinIrr: 0n, buyFeeBps: 0n, sellFeeBps: 0n };
  const price = 10_000_000n; // IRR / gram

  it("BUY rial floors metal so cost cannot exceed budget", () => {
    const q = computeQuote({
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: 10_000_001n,
      requestedWeightUg: 0n,
      executionPriceIrrPerGram: price,
      fees,
    });
    expect(q.weightUg * price / UG_PER_GRAM).toBeLessThanOrEqual(q.netIrr);
  });

  it("BUY weight ceils required rial", () => {
    const q = computeQuote({
      side: "BUY",
      inputMode: "METAL_WEIGHT",
      requestedIrr: 0n,
      requestedWeightUg: 1n,
      executionPriceIrrPerGram: price,
      fees,
    });
    expect(q.grossIrr).toBe(mulDivCeil(1n, price, UG_PER_GRAM));
  });

  it("SELL weight floors proceeds", () => {
    const q = computeQuote({
      side: "SELL",
      inputMode: "METAL_WEIGHT",
      requestedIrr: 0n,
      requestedWeightUg: 3n,
      executionPriceIrrPerGram: price,
      fees,
    });
    expect(q.grossIrr).toBe(mulDivFloor(3n, price, UG_PER_GRAM));
  });

  it("SELL rial target ceils metal", () => {
    const q = computeQuote({
      side: "SELL",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: 100n,
      requestedWeightUg: 0n,
      executionPriceIrrPerGram: price,
      fees,
    });
    expect(q.weightUg).toBe(mulDivCeil(q.grossIrr, UG_PER_GRAM, price));
  });
});

describe("AssetSpec", () => {
  it("maps frozen silver925 UI key to SILVER 999", () => {
    expect(uiInstrumentToAsset("silver925")).toBe("SILVER");
    expect(ASSET_SPECS.SILVER.purityLabel).toBe("999");
    expect(ASSET_SPECS.SILVER.priceInstrument).toBe("IRAN_SILVER_999_IRR_PER_GRAM");
  });

  it("copper is not executable by default", () => {
    expect(ASSET_SPECS.COPPER.executableByDefault).toBe(false);
  });
});

describe("copper integer conversion", () => {
  it("converts USD/tonne × USD/IRR to IRR/gram", () => {
    const irrPerGram = copperIrrPerGram({
      usdPerMetricTonne: 10_000n,
      usdIrr: 1_000_000n,
    });
    expect(irrPerGram).toBe(10_000n);
  });
});
