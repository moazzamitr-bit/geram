import { mulDivFloor, type Irr } from "./money";

/** 1 lb = 453.59237 g → 453_592_370 µg */
export const UG_PER_LB = 453_592_370n;
export const GRAMS_PER_TONNE = 1_000_000n;

/**
 * Theoretical copper IRR/gram from global USD quotes × USD/IRR.
 * Integer-only. Not a supplier-executable Iranian price.
 */
export function copperIrrPerGram(input: {
  usdPerMetricTonne?: bigint;
  usdPerLb?: bigint;
  usdIrr: Irr;
  basisAdjustmentIrrPerGram?: Irr;
}): Irr {
  if (input.usdIrr <= 0n) throw new Error("usdIrr must be > 0");
  let usdPerTonne = input.usdPerMetricTonne ?? 0n;
  if (input.usdPerLb != null && input.usdPerLb > 0n) {
    usdPerTonne = mulDivFloor(input.usdPerLb, GRAMS_PER_TONNE * 1_000_000n, UG_PER_LB);
  }
  if (usdPerTonne <= 0n) throw new Error("copper USD price missing");
  const irrPerGram = mulDivFloor(usdPerTonne, input.usdIrr, GRAMS_PER_TONNE);
  const adj = input.basisAdjustmentIrrPerGram ?? 0n;
  const next = irrPerGram + adj;
  if (next <= 0n) throw new Error("copper IRR/gram not positive");
  return next;
}
