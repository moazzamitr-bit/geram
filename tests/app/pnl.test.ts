import { describe, expect, it } from "vitest";
import { averageBuyPriceFromTrades, unrealizedPnl } from "@/lib/app/pnl";

describe("unrealized pnl cost basis", () => {
  it("adds the buy fee to the average purchase price", () => {
    const avg = averageBuyPriceFromTrades(
      [
        {
          type: "خرید",
          status: "موفق",
          goldMg: 2000,
          pricePerGram: 1_000_000,
          feeRial: 14_000,
          instrument: "gold18",
        },
      ],
      0,
      "gold18"
    );
    expect(avg).toBe(1_007_000);
  });

  it("measures profit from the gross cost when the stored average is missing", () => {
    const row = unrealizedPnl({
      goldMg: 1000,
      marketPricePerGram: 1_010_000,
      avgBuyPricePerGram: 0,
      instrument: "gold18",
      transactions: [
        {
          type: "خرید",
          status: "موفق",
          goldMg: 1000,
          pricePerGram: 1_000_000,
          feeRial: 7_000,
          instrument: "gold18",
        },
      ],
    });
    expect(row.avgBuyPrice).toBe(1_007_000);
    expect(row.costBasis).toBe(1_007_000);
    expect(row.pnl).toBe(3_000);
    expect(row.pnlPct).toBeCloseTo((3_000 / 1_007_000) * 100);
  });
});
