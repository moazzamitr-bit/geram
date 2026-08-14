/** Canonical financial units. Never use JS number for money/metal math. */

export type Irr = bigint;
export type Microgram = bigint;

export const IRR_PER_TOMAN = 10n;
export const UG_PER_GRAM = 1_000_000n;
export const UG_PER_MILLIGRAM = 1000n;
export const BPS_DENOM = 10_000n;

export function irr(n: bigint | number | string): Irr {
  if (typeof n === "bigint") return n;
  if (typeof n === "number") {
    if (!Number.isInteger(n) || !Number.isSafeInteger(n)) {
      throw new Error("irr: number must be a safe integer");
    }
    return BigInt(n);
  }
  if (!/^-?\d+$/.test(n)) throw new Error("irr: invalid string");
  return BigInt(n);
}

export function ug(n: bigint | number | string): Microgram {
  return irr(n);
}

export function tomanToIrr(toman: bigint | number | string): Irr {
  return irr(toman) * IRR_PER_TOMAN;
}

export function irrToTomanFloor(amount: Irr): bigint {
  return amount / IRR_PER_TOMAN;
}

export function gramsToUg(grams: bigint | number | string): Microgram {
  if (typeof grams === "number") {
    if (!Number.isFinite(grams) || grams < 0) throw new Error("gramsToUg: invalid");
    // Display inputs only: convert via milligrams to avoid float grams.
    const mg = Math.round(grams * 1000);
    if (!Number.isSafeInteger(mg)) throw new Error("gramsToUg: unsafe");
    return BigInt(mg) * UG_PER_MILLIGRAM;
  }
  return irr(grams) * UG_PER_GRAM;
}

export function ugToGramsFloor(weight: Microgram): bigint {
  return weight / UG_PER_GRAM;
}

export function mgToUg(mg: bigint | number | string): Microgram {
  return irr(mg) * UG_PER_MILLIGRAM;
}

export function ugToMgFloor(weight: Microgram): bigint {
  return weight / UG_PER_MILLIGRAM;
}

/** Floor(a * b / d) for bigints. */
export function mulDivFloor(a: bigint, b: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("division by zero");
  return (a * b) / d;
}

/** Ceil(a * b / d) for non-negative bigints. */
export function mulDivCeil(a: bigint, b: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("division by zero");
  if (a < 0n || b < 0n) throw new Error("mulDivCeil: negative not supported");
  return (a * b + (d - 1n)) / d;
}

export function maxBig(a: bigint, b: bigint) {
  return a > b ? a : b;
}

export function minBig(a: bigint, b: bigint) {
  return a < b ? a : b;
}

export function serializeInt(n: bigint): string {
  return n.toString();
}

export function parseIntString(n: string | number | bigint): bigint {
  return irr(typeof n === "number" ? n : n);
}

/** UI display only — toman integer if it fits in a JS safe integer. */
export function irrToSafeTomanNumber(amount: Irr): number {
  const toman = irrToTomanFloor(amount);
  if (toman > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("toman exceeds safe integer display");
  }
  return Number(toman);
}

export function ugToSafeMgNumber(weight: Microgram): number {
  const mg = ugToMgFloor(weight);
  if (mg > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("mg exceeds safe integer display");
  }
  return Number(mg);
}
