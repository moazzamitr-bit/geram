import { mulDivFloor, type Irr } from "./money";
import {
  COPPER_STALE_AFTER_MS,
  isTimestampStale,
  observedAtIso,
  parseTehranTimestamp,
} from "@/lib/market/freshness";

/** 1 lb = 453.59237 g → 453_592_370 µg */
export const UG_PER_LB = 453_592_370n;
export const GRAMS_PER_TONNE = 1_000_000n;

/**
 * TGJU's `copper` series froze on 2026-07-20 (USD/tonne, dp=0).
 * `copperp` / `basemetal-copper` are the live USD-per-pound prints.
 * Tonne keys are the daily LME-style fallback.
 */
export const COPPER_SOURCES: { key: string; unit: "lb" | "tonne" }[] = [
  { key: "copperp", unit: "lb" },
  { key: "basemetal-copper", unit: "lb" },
  { key: "basemetal-london-copper", unit: "tonne" },
  { key: "london-copper", unit: "tonne" },
  { key: "base_global_copper", unit: "tonne" },
  { key: "copper", unit: "tonne" },
];

export type CopperObservation = {
  sourceKey: string;
  unit: "lb" | "tonne";
  /** Thousandths of a USD (6.476 → 6476, 14279.3 → 14279300). */
  priceMilli: bigint;
  highMilli: bigint | null;
  lowMilli: bigint | null;
  changePercent: number | null;
  observedAt: string;
  stale: boolean;
};

/**
 * Theoretical copper IRR/gram from global USD quotes × USD/IRR.
 * Integer-only. Not a supplier-executable Iranian price.
 */
export function copperIrrPerGram(input: {
  usdPerMetricTonne?: bigint;
  /** Thousandths of a USD per metric tonne. */
  usdPerTonneMilli?: bigint;
  usdPerLb?: bigint;
  /** Thousandths of a USD per pound. */
  usdPerLbMilli?: bigint;
  usdIrr: Irr;
  basisAdjustmentIrrPerGram?: Irr;
}): Irr {
  if (input.usdIrr <= 0n) throw new Error("usdIrr must be > 0");
  let irrPerGram: Irr;
  if (input.usdPerLbMilli != null && input.usdPerLbMilli > 0n) {
    // milli-USD/lb → IRR/g: (milli/1000) / (µg per lb / 1e6) * usdIrr
    irrPerGram = mulDivFloor(input.usdPerLbMilli * input.usdIrr, 1_000n, UG_PER_LB);
  } else if (input.usdPerTonneMilli != null && input.usdPerTonneMilli > 0n) {
    irrPerGram = mulDivFloor(input.usdPerTonneMilli, input.usdIrr, 1_000_000_000n);
  } else {
    let usdPerTonne = input.usdPerMetricTonne ?? 0n;
    if (input.usdPerLb != null && input.usdPerLb > 0n) {
      usdPerTonne = mulDivFloor(input.usdPerLb, GRAMS_PER_TONNE * 1_000_000n, UG_PER_LB);
    }
    if (usdPerTonne <= 0n) throw new Error("copper USD price missing");
    irrPerGram = mulDivFloor(usdPerTonne, input.usdIrr, GRAMS_PER_TONNE);
  }
  const adj = input.basisAdjustmentIrrPerGram ?? 0n;
  const next = irrPerGram + adj;
  if (next <= 0n) throw new Error("copper IRR/gram not positive");
  return next;
}

function parseUsdMilli(raw: unknown): bigint | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return BigInt(Math.round(raw * 1000));
  }
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const milli = BigInt(whole) * 1000n + BigInt((frac + "000").slice(0, 3));
  return milli > 0n ? milli : null;
}

function parseChange(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function readRow(
  current: Record<string, unknown>,
  key: string,
  unit: "lb" | "tonne",
  now: number
): CopperObservation | null {
  const row = current[key];
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const priceMilli = parseUsdMilli(record.p);
  if (priceMilli == null) return null;
  if (unit === "tonne" && priceMilli < 1_000_000n) return null;
  if (unit === "lb" && priceMilli > 100_000n) return null;
  const ts = typeof record.ts === "string" ? record.ts : "";
  return {
    sourceKey: key,
    unit,
    priceMilli,
    highMilli: parseUsdMilli(record.h),
    lowMilli: parseUsdMilli(record.l),
    changePercent: parseChange(record.dp),
    observedAt: ts ? observedAtIso(ts, now) : new Date(now).toISOString(),
    stale: isTimestampStale(ts, COPPER_STALE_AFTER_MS, now) || parseTehranTimestamp(ts) == null,
  };
}

/** Newest fresh copper print, else the newest stale one. Never prefers the frozen July series when a live key exists. */
export function pickCopperObservation(
  current: Record<string, unknown>,
  now = Date.now()
): CopperObservation | null {
  const rows = COPPER_SOURCES.map((source) => readRow(current, source.key, source.unit, now)).filter(
    (row): row is CopperObservation => row != null
  );
  if (rows.length === 0) return null;
  rows.sort((a, b) => (a.observedAt < b.observedAt ? 1 : a.observedAt > b.observedAt ? -1 : 0));
  return rows.find((row) => !row.stale) ?? rows[0] ?? null;
}
