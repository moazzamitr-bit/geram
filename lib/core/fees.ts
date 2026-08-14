import { BPS_DENOM, maxBig, mulDivFloor, type Irr } from "@/lib/core/money";

export type FeeSnapshot = {
  buyFeeBps: bigint;
  buyFeeMinIrr: Irr;
  sellFeeBps: bigint;
  sellFeeMinIrr: Irr;
};

export type SpreadSnapshot = {
  buySpreadBps: bigint;
  sellSpreadBps: bigint;
};

export const DEFAULT_FEE_SNAPSHOT: FeeSnapshot = {
  buyFeeBps: 70n, // 0.70%
  buyFeeMinIrr: 500_000n, // 50_000 toman
  sellFeeBps: 50n,
  sellFeeMinIrr: 300_000n,
};

export const DEFAULT_SPREAD_SNAPSHOT: SpreadSnapshot = {
  buySpreadBps: 0n,
  sellSpreadBps: 0n,
};

export function feeOnAmount(amount: Irr, bps: bigint, minIrr: Irr): Irr {
  if (amount <= 0n) return 0n;
  return maxBig(minIrr, mulDivFloor(amount, bps, BPS_DENOM));
}

/** Convert legacy percent floats from platform_settings into bps bigint. Display/config only at the edge. */
export function percentToBps(percent: number): bigint {
  if (!Number.isFinite(percent) || percent < 0) throw new Error("invalid percent");
  return BigInt(Math.round(percent * 10_000));
}
