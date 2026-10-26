import type { AssetCode } from "./assets";
import type { PriceFeed } from "./price";
import { CoreError, type PriceQuote } from "./types";

/**
 * Layered protection between any market feed and the ledger. Every priced
 * path (app buy/sell, savings-plan cron, alert auto-buy) goes through
 * FinancialCore.issueQuote/executeTrade, which reads prices only via this guard.
 */

const envBig = (k: string, d: bigint) => {
  const v = process.env[k];
  return v && /^\d+$/.test(v) ? BigInt(v) : d;
};
const envNum = (k: string, d: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v > 0 ? v : d;
};

/** Absolute sanity bands, IRR per gram. A rial/toman (10x) slip always lands outside. */
export const PRICE_BANDS_IRR: Record<AssetCode, readonly [bigint, bigint]> = {
  GOLD: [envBig("GERAM_BAND_GOLD_MIN_IRR", 100_000_000n), envBig("GERAM_BAND_GOLD_MAX_IRR", 800_000_000n)], // 10M–80M toman
  SILVER: [envBig("GERAM_BAND_SILVER_MIN_IRR", 1_500_000n), envBig("GERAM_BAND_SILVER_MAX_IRR", 25_000_000n)], // 150k–2.5M toman (now ~495k)
  TEST_METAL: [1n, 10n ** 15n],
  COPPER: [envBig("GERAM_BAND_COPPER_MIN_IRR", 12_000n), envBig("GERAM_BAND_COPPER_MAX_IRR", 200_000n)], // 1.2k–20k toman (now ~3.9k)
};

export const GUARD = {
  maxJumpPct: envNum("GERAM_PRICE_MAX_JUMP_PCT", 3),
  /** Last-good memory window for the jump check. */
  jumpWindowMs: 30 * 60_000,
  crossMaxPct: envNum("GERAM_PRICE_CROSS_MAX_PCT", 2),
  maxAgeMs: envNum("GERAM_PRICE_MAX_AGE_MS", 3 * 60_000),
  executeMaxMovePct: envNum("GERAM_EXEC_MAX_MOVE_PCT", 1),
};

type Drill = { asset: AssetCode; divisor: bigint; until: number };
const gd = globalThis as unknown as { __priceGuardDrill?: Drill | null };
/** Ops drill: divide the next prices for `asset` by `divisor` (e.g. 10) for up to 5 minutes. */
export function setPriceDrill(asset: AssetCode, divisor: number, minutes: number) {
  gd.__priceGuardDrill = divisor > 1 ? { asset, divisor: BigInt(Math.round(divisor)), until: Date.now() + Math.min(minutes, 5) * 60_000 } : null;
}

export function pctDiff(a: bigint, b: bigint): number {
  const x = Number(a);
  const y = Number(b);
  if (!(x > 0) || !(y > 0)) return Infinity;
  return (Math.abs(x - y) / Math.min(x, y)) * 100;
}

export function inBand(asset: AssetCode, irrPerGram: bigint): boolean {
  const [lo, hi] = PRICE_BANDS_IRR[asset];
  return irrPerGram >= lo && irrPerGram <= hi;
}

export type HaltInfo = { asset: AssetCode; reason: string; values: Record<string, string> };
export type HaltFn = (info: HaltInfo) => Promise<void>;

export type GuardOptions = {
  onHalt: HaltFn;
  /** Independent second source for the same asset (gold: estjt vs TGJU). null = unavailable. */
  crossSource?: (asset: AssetCode, primary: PriceQuote) => Promise<{ source: string; irrPerGram: bigint } | null>;
  now?: () => number;
};

export function withPriceGuard(feed: PriceFeed, opts: GuardOptions): PriceFeed & { resetLastGood(asset?: AssetCode): void } {
  const now = opts.now ?? Date.now;
  const lastGood = new Map<AssetCode, { irr: bigint; at: number; source: string }>();

  const halt = async (asset: AssetCode, reason: string, values: Record<string, string>) => {
    lastGood.delete(asset);
    try {
      await opts.onHalt({ asset, reason, values });
    } catch (err) {
      console.error("[price-guard] halt write failed", err);
    }
    console.error(`[price-guard] HALT ${asset}: ${reason}`, values);
    throw new CoreError("price_guard", `Price rejected: ${reason}`, 503);
  };

  return {
    resetLastGood(asset) {
      if (asset) lastGood.delete(asset);
      else lastGood.clear();
    },
    async getExecutable(asset) {
      let q = await feed.getExecutable(asset);
      const drill = gd.__priceGuardDrill;
      if (drill && drill.asset === asset && drill.until > Date.now()) {
        q = { ...q, irrPerGram: q.irrPerGram / drill.divisor, source: `${q.source}+drill` };
      }
      const p = q.irrPerGram;
      const t = now();

      if (!inBand(asset, p)) {
        const [lo, hi] = PRICE_BANDS_IRR[asset];
        await halt(asset, "out_of_band", { source: q.source, irrPerGram: p.toString(), bandIrr: `${lo}-${hi}` });
      }

      const observed = Date.parse(q.observedAt);
      if (q.stale || !Number.isFinite(observed) || t - observed > GUARD.maxAgeMs) {
        // Never trade stale. Auto-recovers once a fresh, valid price arrives.
        throw new CoreError("price_stale", "No fresh validated price", 503);
      }

      const prev = lastGood.get(asset);
      if (prev && t - prev.at < GUARD.jumpWindowMs) {
        const jump = pctDiff(prev.irr, p);
        if (jump > GUARD.maxJumpPct) {
          await halt(asset, "jump", {
            lastGoodIrr: prev.irr.toString(),
            lastGoodSource: prev.source,
            newIrr: p.toString(),
            newSource: q.source,
            pct: jump.toFixed(2),
          });
        }
      }

      if (opts.crossSource) {
        const other = await opts.crossSource(asset, q).catch(() => null);
        if (other) {
          const d = pctDiff(other.irrPerGram, p);
          if (d > GUARD.crossMaxPct) {
            await halt(asset, "cross_source", {
              [q.source]: p.toString(),
              [other.source]: other.irrPerGram.toString(),
              pct: d.toFixed(2),
            });
          }
        }
      }

      lastGood.set(asset, { irr: p, at: t, source: q.source });
      return q;
    },
  };
}

export const EXPOSURE = {
  perOrderMaxIrr: envBig("GERAM_MAX_ORDER_IRR", 5_000_000_000n), // 500M toman
  perUserDailyBuyMaxIrr: envBig("GERAM_MAX_USER_DAILY_BUY_IRR", 20_000_000_000n), // 2B toman
  platformHourlyNetBuyMaxIrr: envBig("GERAM_MAX_PLATFORM_HOURLY_NET_BUY_IRR", 50_000_000_000n), // 5B toman
};
