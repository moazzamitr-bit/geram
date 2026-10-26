import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { divergencePct, parseEstjtHtml } from "@/lib/market/estjt";

const html = readFileSync(join(__dirname, "fixtures/estjt-price-2026-10-26.html"), "utf8");

describe("estjt parser", () => {
  it("reads the page as TOMAN and converts to rial (10x incident regression)", () => {
    const s = parseEstjtHtml(html);
    expect(s.gold18Rial).toBe(263_909_000n);
    // 2026-10-26 incident: treating 26,390,900 as rial showed gold at 2.6M toman.
    expect(Number(s.gold18Rial) / 10).toBeGreaterThan(10_000_000);
    expect(s.gold24Rial).toBe(351_840_000n);
    expect(s.mazanehRial).toBe(1_143_200_000n);
    expect(s.coins.find((c) => c.label === "سکه طرح جدید")?.rial).toBe(2_691_000_000n);
    expect(s.coins.length).toBeGreaterThanOrEqual(4);
  });
  it("returns null gold when the table is missing", () => {
    expect(parseEstjtHtml("<html><body>maintenance</body></html>").gold18Rial).toBeNull();
  });
  it("computes divergence", () => {
    expect(divergencePct(100, 101.5)).toBeCloseTo(1.5);
  });
});

import { staticPriceFeed, withEstjtGoldFallback, type PriceFeed } from "@/lib/core/price";

describe("estjt gold fallback", () => {
  const est = async () => ({ gold18Rial: 263_909_000n, fetchedAt: "2026-10-26T10:00:00.000Z" });
  it("keeps TGJU when live", async () => {
    const q = await withEstjtGoldFallback(staticPriceFeed({ GOLD: 26_000_000n }), est).getExecutable("GOLD");
    expect(q.source).toBe("test-static");
  });
  it("uses estjt when TGJU fails", async () => {
    const down: PriceFeed = { getExecutable: async () => { throw new Error("down"); } };
    const q = await withEstjtGoldFallback(down, est).getExecutable("GOLD");
    expect(q.source).toBe("estjt:gold18");
    expect(q.irrPerGram).toBe(263_909_000n);
  });
  it("never uses estjt for silver", async () => {
    const down: PriceFeed = { getExecutable: async () => { throw new Error("down"); } };
    await expect(withEstjtGoldFallback(down, est).getExecutable("SILVER")).rejects.toThrow();
  });
});
