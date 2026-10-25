import { describe, expect, it } from "vitest";
import { buyQuote, sellQuote } from "@/lib/commerce/fees";
import {
  formatGramInput,
  gramsForTargetSellNet,
  parseAmount,
  quotePreview,
  receiptUnitPrice,
  tomanForTargetBuyGrams,
} from "@/lib/app/trade-amount";

const price = 7_000_000;

describe("trade amount linking", () => {
  it("parses Persian and grouped numbers", () => {
    expect(parseAmount("۱٬۰۰۰")).toBe(1000);
    expect(parseAmount("12.5")).toBe(12.5);
    expect(parseAmount("")).toBe(0);
  });

  it("links a buy toman amount to grams after the fee", () => {
    const preview = quotePreview({
      side: "buy",
      edited: "toman",
      toman: 1_000_000,
      grams: 0,
      pricePerGram: price,
      plus: false,
    });
    const direct = buyQuote(1_000_000, price, false);
    expect(preview.fee).toBe(direct.fee);
    expect(preview.goldMg).toBe(direct.goldMg);
    expect(preview.grams).toBeCloseTo(direct.goldMg / 1000, 6);
  });

  it("solves the toman that buys about the requested grams", () => {
    const grams = 0.142;
    const toman = tomanForTargetBuyGrams(grams, price, false);
    const quote = buyQuote(toman, price, false);
    expect(Math.abs(quote.goldMg / 1000 - grams)).toBeLessThan(0.002);
  });

  it("links a sell weight to net toman", () => {
    const preview = quotePreview({
      side: "sell",
      edited: "gram",
      toman: 0,
      grams: 1,
      pricePerGram: price,
      plus: false,
    });
    const direct = sellQuote(1000, price, false);
    expect(preview.fee).toBe(direct.fee);
    expect(preview.net).toBe(direct.net);
    expect(preview.toman).toBe(direct.net);
  });

  it("shows the executed toman per gram on the receipt", () => {
    expect(receiptUnitPrice(26_063_300, 0)).toBe(26_063_300);
    expect(receiptUnitPrice(26_063_300, 1)).toBe(26_063_300);
    expect(receiptUnitPrice(0, 26_063_300)).toBe(26_063_300);
    expect(receiptUnitPrice(0, 0)).toBe(0);
  });

  it("solves grams for a target sell net", () => {
    const target = sellQuote(1000, price, false).net;
    const grams = gramsForTargetSellNet(target, price, false);
    expect(Math.abs(grams - 1)).toBeLessThan(0.01);
    expect(formatGramInput(1)).toBe("1");
    expect(formatGramInput(0)).toBe("0");
  });
});
