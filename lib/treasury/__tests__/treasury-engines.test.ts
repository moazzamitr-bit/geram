import { describe, expect, it } from "vitest";
import { createLotState, consumeLotsFifo } from "@/lib/treasury/inventory";
import {
  applyConsumeToWac,
  applyPurchaseToWac,
  emptyWacPool,
  wacPerGram,
  wacPerMg,
} from "@/lib/treasury/wac";
import { computePosition } from "@/lib/treasury/position";
import {
  computeEffectiveSpreads,
  quoteWithSpread,
  spreadRevenueCustomerBuy,
  spreadRevenueCustomerSell,
} from "@/lib/treasury/spread";
import { aggregatePeriodPnl, realizeTradePnl } from "@/lib/treasury/pnl";
import {
  formatBuyRecommendation,
  recommendReplenishment,
} from "@/lib/treasury/replenishment";
import { DEFAULT_SPREAD_SETTINGS } from "@/lib/treasury/types";

describe("inventory lots", () => {
  it("creates a purchase lot with remaining = weight", () => {
    const lot = createLotState("l1", {
      asset: "GOLD",
      weightMg: 1_000_000,
      acquisitionCostToman: 50_000_000_000,
      supplier: "refinery-a",
    });
    expect(lot.remainingMg).toBe(1_000_000);
    expect(lot.status).toBe("ACTIVE");
    expect(lot.unitCostTomanPerMg).toBe(50_000);
  });

  it("supports partial FIFO consumption", () => {
    const a = createLotState("a", {
      asset: "GOLD",
      weightMg: 1000,
      acquisitionCostToman: 10_000_000,
      supplier: "s1",
      purchasedAt: "2026-01-01",
    });
    const b = createLotState("b", {
      asset: "GOLD",
      weightMg: 2000,
      acquisitionCostToman: 22_000_000,
      supplier: "s2",
      purchasedAt: "2026-02-01",
    });
    const { lots, consumptions } = consumeLotsFifo([a, b], "GOLD", 1500);
    expect(consumptions).toEqual([
      { lotId: "a", weightMg: 1000 },
      { lotId: "b", weightMg: 500 },
    ]);
    const nextA = lots.find((l) => l.id === "a")!;
    const nextB = lots.find((l) => l.id === "b")!;
    expect(nextA.status).toBe("DEPLETED");
    expect(nextB.remainingMg).toBe(1500);
  });
});

describe("WAC engine", () => {
  it("updates average cost on purchases", () => {
    let pool = emptyWacPool("GOLD");
    pool = applyPurchaseToWac(pool, 1000, 10_000_000);
    pool = applyPurchaseToWac(pool, 1000, 14_000_000);
    expect(pool.totalWeightMg).toBe(2000);
    expect(wacPerMg(pool)).toBe(12_000);
    expect(wacPerGram(pool)).toBe(12_000_000);
  });

  it("consumes at WAC and reduces pool", () => {
    let pool = emptyWacPool("SILVER");
    pool = applyPurchaseToWac(pool, 2000, 20_000_000);
    const { pool: next, costToman } = applyConsumeToWac(pool, 500);
    expect(costToman).toBe(5_000_000);
    expect(next.totalWeightMg).toBe(1500);
  });
});

describe("coverage / position", () => {
  it("computes available inventory and coverage ratio", () => {
    const pool = applyPurchaseToWac(emptyWacPool("GOLD"), 10_000, 100_000_000);
    const pos = computePosition({
      asset: "GOLD",
      physicalInventoryMg: 10_000,
      customerLiabilityMg: 8_000,
      reservedInventoryMg: 500,
      pool,
      marketPriceTomanPerGram: 12_000_000,
    });
    expect(pos.availableInventoryMg).toBe(1500);
    expect(pos.coverageRatio).toBeCloseTo(1.25);
    expect(pos.netMetalPositionMg).toBe(2000);
  });
});

describe("spread engine", () => {
  it("keeps buy/sell spreads independent of fees", () => {
    const q = quoteWithSpread("GOLD", 10_000_000, DEFAULT_SPREAD_SETTINGS);
    expect(q.customerBuyPriceTomanPerGram).toBeGreaterThan(10_000_000);
    expect(q.customerSellPriceTomanPerGram).toBeLessThan(10_000_000);
    expect(spreadRevenueCustomerBuy(1000, 10_000_000, q.customerBuyPriceTomanPerGram)).toBeGreaterThan(0);
    expect(spreadRevenueCustomerSell(1000, 10_000_000, q.customerSellPriceTomanPerGram)).toBeGreaterThan(0);
  });

  it("widens spread on shortage / volatility", () => {
    const base = computeEffectiveSpreads("GOLD", DEFAULT_SPREAD_SETTINGS);
    const stressed = computeEffectiveSpreads("GOLD", DEFAULT_SPREAD_SETTINGS, {
      volatilityHigh: true,
      liquidityLow: true,
      coverageRatio: 0.9,
    });
    expect(stressed.buySpreadBps).toBeGreaterThan(base.buySpreadBps);
  });
});

describe("P&L", () => {
  it("realizes customer buy as spread+fee minus COGS", () => {
    const r = realizeTradePnl({
      side: "CUSTOMER_BUY",
      spreadRevenueToman: 100_000,
      feeRevenueToman: 50_000,
      inventoryCostToman: 80_000,
    });
    expect(r.realizedPnlToman).toBe(70_000);
  });

  it("aggregates period metrics", () => {
    const period = aggregatePeriodPnl({
      trades: [
        {
          spreadRevenueToman: 100,
          feeRevenueToman: 50,
          inventoryCostToman: 40,
          realizedPnlToman: 110,
        },
      ],
      operationalCostToman: 10,
      inventoryMarketValueToman: 1000,
      inventoryBookValueToman: 800,
    });
    expect(period.realizedPnlToman).toBe(100);
    expect(period.unrealizedPnlToman).toBe(200);
  });
});

describe("replenishment", () => {
  it("recommends buy when coverage below target and never auto-executes", () => {
    const rec = recommendReplenishment({
      asset: "GOLD",
      physicalInventoryMg: 1_000_000,
      customerLiabilityMg: 1_000_000,
    });
    expect(rec).not.toBeNull();
    expect(rec!.recommendedWeightMg).toBeGreaterThan(0);
    expect(formatBuyRecommendation(rec!)).toMatch(/^BUY /);
    expect(formatBuyRecommendation(rec!)).toContain("GOLD");
  });

  it("returns null when coverage is healthy", () => {
    const rec = recommendReplenishment({
      asset: "GOLD",
      physicalInventoryMg: 2_000_000,
      customerLiabilityMg: 1_000_000,
    });
    expect(rec).toBeNull();
  });
});

describe("customer buy/sell economics (unit)", () => {
  it("customer buy consumes inventory at WAC", () => {
    let pool = applyPurchaseToWac(emptyWacPool("GOLD"), 5000, 50_000_000);
    const lots = [
      createLotState("l1", {
        asset: "GOLD",
        weightMg: 5000,
        acquisitionCostToman: 50_000_000,
        supplier: "s",
        purchasedAt: "2026-01-01",
      }),
    ];
    const buyMg = 1000;
    const { costToman, pool: next } = applyConsumeToWac(pool, buyMg);
    const { lots: after } = consumeLotsFifo(lots, "GOLD", buyMg);
    expect(costToman).toBe(10_000_000);
    expect(next.totalWeightMg).toBe(4000);
    expect(after.find((l) => l.id === "l1")!.remainingMg).toBe(4000);
  });

  it("customer sell acquires inventory into WAC pool", () => {
    let pool = emptyWacPool("GOLD");
    pool = applyPurchaseToWac(pool, 2000, 18_000_000);
    expect(pool.totalWeightMg).toBe(2000);
    expect(wacPerMg(pool)).toBe(9000);
  });
});
