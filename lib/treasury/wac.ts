import type { TreasuryAsset, WacPool } from "@/lib/treasury/types";

export function emptyWacPool(asset: TreasuryAsset): WacPool {
  return { asset, totalWeightMg: 0, totalCostToman: 0 };
}

/** Weighted average cost per milligram (toman). */
export function wacPerMg(pool: WacPool): number {
  if (pool.totalWeightMg <= 0) return 0;
  return pool.totalCostToman / pool.totalWeightMg;
}

export function wacPerGram(pool: WacPool): number {
  return wacPerMg(pool) * 1000;
}

/** Apply a purchase / customer-sell acquire into the WAC pool. */
export function applyPurchaseToWac(
  pool: WacPool,
  weightMg: number,
  costToman: number
): WacPool {
  if (weightMg <= 0 || costToman < 0) {
    throw new Error("invalid_purchase");
  }
  return {
    ...pool,
    totalWeightMg: pool.totalWeightMg + weightMg,
    totalCostToman: pool.totalCostToman + costToman,
  };
}

/**
 * Consume inventory for a customer buy.
 * Cost removed at current WAC (integer toman, floored).
 */
export function applyConsumeToWac(
  pool: WacPool,
  weightMg: number
): { pool: WacPool; costToman: number; wacTomanPerMg: number } {
  if (weightMg <= 0) throw new Error("invalid_consume_weight");
  if (weightMg > pool.totalWeightMg) {
    throw new Error("insufficient_inventory");
  }
  const unit = wacPerMg(pool);
  const costToman = Math.floor(unit * weightMg);
  return {
    wacTomanPerMg: unit,
    costToman,
    pool: {
      ...pool,
      totalWeightMg: pool.totalWeightMg - weightMg,
      totalCostToman: Math.max(0, pool.totalCostToman - costToman),
    },
  };
}

export function unitCostPerMg(weightMg: number, costToman: number): number {
  if (weightMg <= 0) throw new Error("invalid_weight");
  return costToman / weightMg;
}
