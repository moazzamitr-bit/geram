import type { TreasuryPosition } from "@/lib/treasury/types";

export type PriceShockScenario = {
  label: string;
  priceShockPercent: number;
  marketValueAfterToman: number;
  unrealizedPnlAfterToman: number;
  coverageRatio: number | null;
};

/**
 * Simulate mark-to-market impact of a mid-price shock on inventory.
 * Liability coverage is physical/liability (unchanged by price).
 */
export function simulatePriceShock(
  position: TreasuryPosition,
  shocksPercent: number[] = [-10, -5, 0, 5, 10]
): PriceShockScenario[] {
  return shocksPercent.map((pct) => {
    const price = Math.floor(
      position.marketPriceTomanPerGram * (1 + pct / 100)
    );
    const marketValue = Math.floor(
      (position.physicalInventoryMg / 1000) * Math.max(0, price)
    );
    return {
      label: `${pct >= 0 ? "+" : ""}${pct}%`,
      priceShockPercent: pct,
      marketValueAfterToman: marketValue,
      unrealizedPnlAfterToman: marketValue - position.inventoryBookValueToman,
      coverageRatio: position.coverageRatio,
    };
  });
}

export type ExposureSummary = {
  asset: TreasuryPosition["asset"];
  longPhysicalMg: number;
  shortLiabilityMg: number;
  netMg: number;
  coverageRatio: number | null;
  availableMg: number;
  riskFlags: string[];
};

export function summarizeExposure(
  position: TreasuryPosition,
  coverageCritical = 1,
  coverageTarget = 1.15
): ExposureSummary {
  const flags: string[] = [];
  if (position.availableInventoryMg < 0) {
    flags.push("NEGATIVE_AVAILABLE");
  }
  if (
    position.coverageRatio != null &&
    position.coverageRatio < coverageCritical
  ) {
    flags.push("COVERAGE_CRITICAL");
  } else if (
    position.coverageRatio != null &&
    position.coverageRatio < coverageTarget
  ) {
    flags.push("COVERAGE_BELOW_TARGET");
  }
  if (position.netMetalPositionMg < 0) {
    flags.push("NET_SHORT");
  }
  return {
    asset: position.asset,
    longPhysicalMg: position.physicalInventoryMg,
    shortLiabilityMg: position.customerLiabilityMg,
    netMg: position.netMetalPositionMg,
    coverageRatio: position.coverageRatio,
    availableMg: position.availableInventoryMg,
    riskFlags: flags,
  };
}
