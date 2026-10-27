/**
 * Single source of truth for how a guarded base price becomes the user's buy/sell price.
 * Values live in platform_settings ("pricing" + "fees", edited in /admin/settings, audit-logged).
 * This module caches them in memory (15s) so sync callers (engine, display) stay consistent.
 *
 * Order of operations (never change): TGJU/estjt raw base → price guards (band/jump/cross/stale)
 * → spread (here) → fee (computeQuote). Guards and the 1% execution recheck always see the RAW base.
 */
import type { AssetCode } from "@/lib/core/assets";
import { DEFAULT_SPREAD_SNAPSHOT, type SpreadSnapshot } from "@/lib/core/fees";
import { applySpread } from "@/lib/core/quote-math";
import { DEFAULT_COMMERCE_SETTINGS, type CommerceSettings, type GoldBaseKey } from "@/lib/commerce/types";

const TTL_MS = 15_000;
type Cache = { settings: CommerceSettings; loadedAt: number; inflight: Promise<void> | null };
const g = globalThis as unknown as { __geramPricing?: Cache };
const cache = (): Cache => (g.__geramPricing ??= { settings: DEFAULT_COMMERCE_SETTINGS, loadedAt: 0, inflight: null });

export function currentSettings(): CommerceSettings {
  return cache().settings;
}

/** Called right after an admin save so the change applies instantly in this process. */
export function setPricingSettings(settings: CommerceSettings) {
  const c = cache();
  c.settings = settings;
  c.loadedAt = Date.now();
}

export async function ensurePricingFresh(): Promise<void> {
  const c = cache();
  if (Date.now() - c.loadedAt < TTL_MS) return;
  if (c.inflight) return c.inflight;
  c.inflight = (async () => {
    try {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITEST === "true") return;
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const { mergeSettings } = await import("@/lib/commerce/settings-server");
      const { data, error } = await createServiceClient().from("platform_settings").select("key, value");
      if (!error && data?.length) setPricingSettings(mergeSettings(data));
    } catch (e) {
      console.error("[pricing] settings refresh failed; keeping last values", e);
    } finally {
      c.inflight = null;
    }
  })();
  return c.inflight;
}

/** TGJU rows to try for 18k gold, chosen base first. The 2018-dated geram18_buy row is never used. */
export function goldBaseKeys(base: GoldBaseKey = currentSettings().pricing.goldBase): string[] {
  return base === "geram18" ? ["geram18", "tgju_gold_irg18"] : ["tgju_gold_irg18", "geram18"];
}

export function toBps(fraction: number): bigint {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 0.02) return 0n; // out of bounds → no spread
  return BigInt(Math.round(fraction * 10_000));
}

export function spreadFor(asset: AssetCode | string, settings: CommerceSettings = currentSettings()): SpreadSnapshot {
  if (asset !== "GOLD" && asset !== "gold18") return DEFAULT_SPREAD_SNAPSHOT; // silver/copper: unchanged
  return {
    buySpreadBps: toBps(settings.pricing.goldBuySpreadPercent),
    sellSpreadBps: toBps(settings.pricing.goldSellSpreadPercent),
  };
}

/** Display buy/sell (toman/g) from a raw base, using the exact engine spread math (IRR, floor). */
export function sidePricesToman(instrument: AssetCode | string, baseToman: number, settings?: CommerceSettings) {
  if (!(baseToman > 0)) return { buyToman: 0, sellToman: 0 };
  const sp = spreadFor(instrument, settings);
  const base = BigInt(Math.round(baseToman)) * 10n;
  return {
    buyToman: Number(applySpread(base, "BUY", sp) / 10n),
    sellToman: Number(applySpread(base, "SELL", sp) / 10n),
  };
}
