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
  /**
   * Max age of the SOURCE's own timestamp, per metal. TGJU stamps a row only when the
   * price changes: 18k ticks every few seconds, silver_999 every 20-60 min, the dollar
   * leg hourly and global copper per session. A flat 3 min blocked silver/copper all day.
   * Wrong prices are still caught by the band, 3% jump, gold cross-source and the 1%
   * re-price at execution; the provider's own stale flag (2h spot / 36h copper) applies too.
   */
  maxAgeMsByAsset: {
    GOLD: envNum("GERAM_PRICE_MAX_AGE_MS_GOLD", 30 * 60_000),
    SILVER: envNum("GERAM_PRICE_MAX_AGE_MS_SILVER", 2 * 60 * 60_000),
    COPPER: envNum("GERAM_PRICE_MAX_AGE_MS_COPPER", 36 * 60 * 60_000),
    TEST_METAL: envNum("GERAM_PRICE_MAX_AGE_MS", 3 * 60_000),
  } as Record<AssetCode, number>,
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

export const RECOVERY = { goodReadsToClear: 2, jumpConfirmReads: 3 };

/**
 * Hard faults (out-of-band, e.g. a 10x unit slip) persist a kill switch until an admin resumes.
 * Soft faults (stale, cross-source disagreement) only reject the read; trading resumes by itself
 * after RECOVERY.goodReadsToClear consecutive good reads. A >3% jump rejects that read and keeps
 * the last good price; if the new level repeats for RECOVERY.jumpConfirmReads reads it is accepted.
 */
export function withPriceGuard(feed: PriceFeed, opts: GuardOptions): PriceFeed & { resetLastGood(asset?: AssetCode): void } {
  const now = opts.now ?? Date.now;
  type St = { lastGood?: { irr: bigint; at: number; source: string }; recovering: number; jump?: { irr: bigint; count: number } };
  const state = new Map<AssetCode, St>();
  const st = (a: AssetCode) => {
    let v = state.get(a);
    if (!v) state.set(a, (v = { recovering: 0 }));
    return v;
  };

  const hardHalt = async (asset: AssetCode, reason: string, values: Record<string, string>) => {
    state.delete(asset);
    try {
      await opts.onHalt({ asset, reason, values });
    } catch (err) {
      console.error("[price-guard] halt write failed", err);
    }
    console.error(`[price-guard] HALT ${asset}: ${reason}`, values);
    throw new CoreError("price_guard", `Price rejected: ${reason}`, 503);
  };
  const soft = (asset: AssetCode, code: string, reason: string, values: Record<string, string> = {}) => {
    st(asset).recovering = RECOVERY.goodReadsToClear;
    console.warn(`[price-guard] soft ${asset}: ${reason}`, values);
    throw new CoreError(code, `Price rejected: ${reason}`, 503);
  };

  return {
    resetLastGood(asset) {
      if (asset) state.delete(asset);
      else state.clear();
    },
    async getExecutable(asset) {
      let q = await feed.getExecutable(asset).catch((err) => {
        st(asset).recovering = RECOVERY.goodReadsToClear;
        throw err;
      });
      const drill = gd.__priceGuardDrill;
      if (drill && drill.asset === asset && drill.until > Date.now()) {
        q = { ...q, irrPerGram: q.irrPerGram / drill.divisor, source: `${q.source}+drill` };
      }
      const p = q.irrPerGram;
      const t = now();
      const s = st(asset);

      if (!inBand(asset, p)) {
        const [lo, hi] = PRICE_BANDS_IRR[asset];
        await hardHalt(asset, "out_of_band", { source: q.source, irrPerGram: p.toString(), bandIrr: `${lo}-${hi}` });
      }

      const observed = Date.parse(q.observedAt);
      if (q.stale || !Number.isFinite(observed) || t - observed > GUARD.maxAgeMsByAsset[asset]) {
        soft(asset, "price_stale", "stale");
      }

      if (opts.crossSource) {
        // Only compared when the other source is fresh too; single healthy source trades alone.
        const other = await opts.crossSource(asset, q).catch(() => null);
        if (other) {
          const d = pctDiff(other.irrPerGram, p);
          if (d > GUARD.crossMaxPct) {
            soft(asset, "price_guard", "cross_source", { [q.source]: p.toString(), [other.source]: other.irrPerGram.toString(), pct: d.toFixed(2) });
          }
        }
      }

      const prev = s.lastGood;
      if (prev && t - prev.at < GUARD.jumpWindowMs && pctDiff(prev.irr, p) > GUARD.maxJumpPct) {
        const same = s.jump && pctDiff(s.jump.irr, p) <= GUARD.maxJumpPct;
        s.jump = { irr: p, count: same ? s.jump!.count + 1 : 1 };
        if (s.jump.count < RECOVERY.jumpConfirmReads) {
          console.warn(`[price-guard] jump ${asset} rejected (${s.jump.count}/${RECOVERY.jumpConfirmReads})`, { last: prev.irr.toString(), next: p.toString() });
          throw new CoreError("price_guard", "Price rejected: jump", 503);
        }
        console.warn(`[price-guard] jump ${asset} accepted as real move`, { last: prev.irr.toString(), next: p.toString() });
      }
      s.jump = undefined;
      s.lastGood = { irr: p, at: t, source: q.source };

      if (s.recovering > 0) {
        s.recovering -= 1;
        if (s.recovering > 0) throw new CoreError("price_recovering", "Price recovering; retry shortly", 503);
        console.warn(`[price-guard] ${asset} recovered`);
      }
      return q;
    },
  };
}

export const EXPOSURE = {
  perOrderMaxIrr: envBig("GERAM_MAX_ORDER_IRR", 5_000_000_000n), // 500M toman
  perUserDailyBuyMaxIrr: envBig("GERAM_MAX_USER_DAILY_BUY_IRR", 20_000_000_000n), // 2B toman
  platformHourlyNetBuyMaxIrr: envBig("GERAM_MAX_PLATFORM_HOURLY_NET_BUY_IRR", 50_000_000_000n), // 5B toman
};
