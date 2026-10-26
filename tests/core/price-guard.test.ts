import { describe, expect, it } from "vitest";
import { staticPriceFeed, type PriceFeed } from "@/lib/core/price";
import { withPriceGuard, inBand, type HaltInfo } from "@/lib/core/price-guard";
import { parseEstjtHtml } from "@/lib/market/estjt";
import type { PriceQuote } from "@/lib/core/types";

function feedOf(get: () => Partial<PriceQuote>): PriceFeed {
  return {
    async getExecutable(asset) {
      const base = await staticPriceFeed({ GOLD: 261_185_000n, SILVER: 4_951_100n, COPPER: 38_960n }).getExecutable(asset);
      return { ...base, ...get() } as PriceQuote;
    },
  };
}
const halts: HaltInfo[] = [];
const onHalt = async (h: HaltInfo) => void halts.push(h);

describe("price guard", () => {
  it("bands: 10x rial/toman slip is out of band for every metal", () => {
    expect(inBand("GOLD", 261_185_000n)).toBe(true);
    expect(inBand("GOLD", 26_118_500n)).toBe(false); // the incident value
    expect(inBand("GOLD", 2_611_850_000n)).toBe(false);
    expect(inBand("SILVER", 4_951_100n)).toBe(true);
    expect(inBand("SILVER", 495_110n)).toBe(false);
    expect(inBand("COPPER", 38_960n)).toBe(true);
    expect(inBand("COPPER", 3_896n)).toBe(false);
  });

  it("rejects and halts on the exact incident price", async () => {
    halts.length = 0;
    const g = withPriceGuard(feedOf(() => ({ irrPerGram: 26_118_500n, source: "estjt:gold18" })), { onHalt });
    await expect(g.getExecutable("GOLD")).rejects.toMatchObject({ code: "price_guard" });
    expect(halts[0]).toMatchObject({ asset: "GOLD", reason: "out_of_band" });
  });

  it("rejects a >3% jump vs last good and halts", async () => {
    halts.length = 0;
    let p = 261_185_000n;
    const g = withPriceGuard(feedOf(() => ({ irrPerGram: p })), { onHalt });
    await g.getExecutable("GOLD");
    p = 271_000_000n; // +3.76%
    await expect(g.getExecutable("GOLD")).rejects.toMatchObject({ code: "price_guard" });
    expect(halts[0].reason).toBe("jump");
  });

  it("allows small moves", async () => {
    let p = 261_185_000n;
    const g = withPriceGuard(feedOf(() => ({ irrPerGram: p })), { onHalt });
    await g.getExecutable("GOLD");
    p = 265_000_000n; // +1.46%
    await expect(g.getExecutable("GOLD")).resolves.toMatchObject({ irrPerGram: p });
  });

  it("halts when gold sources disagree >2%", async () => {
    halts.length = 0;
    const g = withPriceGuard(feedOf(() => ({})), {
      onHalt,
      crossSource: async () => ({ source: "estjt:gold18", irrPerGram: 270_000_000n }),
    });
    await expect(g.getExecutable("GOLD")).rejects.toMatchObject({ code: "price_guard" });
    expect(halts[0].reason).toBe("cross_source");
  });

  it("rejects stale or old prices", async () => {
    const old = new Date(Date.now() - 5 * 60_000).toISOString();
    const g = withPriceGuard(feedOf(() => ({ observedAt: old })), { onHalt });
    await expect(g.getExecutable("GOLD")).rejects.toMatchObject({ code: "price_stale" });
    const g2 = withPriceGuard(feedOf(() => ({ stale: true })), { onHalt });
    await expect(g2.getExecutable("SILVER")).rejects.toMatchObject({ code: "price_stale" });
  });

  it("estjt toman page parses into an in-band rial price", () => {
    const html = "<table><tr><td>طلای ۱۸ عیار</td><td>۲۶,۱۱۸,۵۰۰</td></tr></table>";
    const s = parseEstjtHtml(html);
    expect(s.gold18Rial).toBe(261_185_000n);
    expect(inBand("GOLD", s.gold18Rial!)).toBe(true);
  });
});

import { readFileSync, existsSync } from "node:fs";
describe("guard wiring (CI tripwire)", () => {
  it("production runtime wraps the feed in withPriceGuard and executeTrade re-validates", () => {
    expect(readFileSync("lib/core/runtime.ts", "utf8")).toMatch(/withPriceGuard\(/);
    expect(readFileSync("lib/core/engine.ts", "utf8")).toMatch(/price_moved/);
    expect(existsSync("tests/core/exec-guard.test.ts")).toBe(true);
  });
});
