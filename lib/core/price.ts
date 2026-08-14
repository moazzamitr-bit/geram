import { ASSET_SPECS, type AssetCode } from "./assets";
import { copperIrrPerGram } from "./copper-price";
import { irr, tomanToIrr, type Irr } from "./money";
import { CoreError, type PriceHealth, type PriceQuote } from "./types";

export type PriceFeed = {
  getExecutable(asset: AssetCode): Promise<PriceQuote>;
};

function quote(partial: Omit<PriceQuote, "stale"> & { stale?: boolean }): PriceQuote {
  return {
    ...partial,
    stale: partial.stale ?? partial.health === "STALE",
  };
}

/** Fixed prices for tests. Never used as a silent production fallback. */
export function staticPriceFeed(prices: Partial<Record<AssetCode, Irr>>): PriceFeed {
  return {
    async getExecutable(asset) {
      const p = prices[asset];
      if (p == null || p <= 0n) {
        throw new CoreError("price_unavailable", `No test price for ${asset}`, 503);
      }
      return quote({
        instrument: ASSET_SPECS[asset].priceInstrument,
        asset,
        irrPerGram: p,
        source: "test-static",
        sourceMode: "SUPPLIER_EXECUTABLE",
        permittedForProduction: true,
        health: "LIVE",
        observedAt: new Date().toISOString(),
      });
    },
  };
}

function parseIntLoose(input: unknown): bigint | null {
  if (typeof input === "bigint") return input;
  if (typeof input === "number" && Number.isInteger(input) && Number.isSafeInteger(input)) {
    return BigInt(input);
  }
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[^\d-]/g, "");
  if (!cleaned || cleaned === "-") return null;
  try {
    return irr(cleaned);
  } catch {
    return null;
  }
}

function pickRow(current: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const row = current[key];
    if (row && typeof row === "object") return { key, row: row as Record<string, unknown> };
  }
  return null;
}

/**
 * TGJU-backed executable feed.
 * Silver uses silver_999 only — never silently prices 925 as 999.
 * Seed fallback is forbidden for executable quotes.
 */
export function tgjuExecutableFeed(fetchCurrent: () => Promise<Record<string, unknown>>): PriceFeed {
  return {
    async getExecutable(asset) {
      let current: Record<string, unknown>;
      try {
        current = await fetchCurrent();
      } catch {
        throw new CoreError("price_unavailable", "market feed unreachable", 503);
      }

      if (asset === "GOLD") {
        const picked = pickRow(current, ["geram18", "geram18_buy", "tgju_gold_irg18"]);
        const p = picked ? parseIntLoose(picked.row.p) : null;
        if (!p || p < 1_000_000n) {
          throw new CoreError("price_unavailable", "gold 18k price invalid", 503);
        }
        return quote({
          instrument: "IRAN_GOLD_18K_IRR_PER_GRAM",
          asset,
          irrPerGram: p,
          source: picked!.key,
          sourceMode: "TEMPORARY_PUBLIC",
          permittedForProduction: false,
          health: "LIVE",
          observedAt: new Date().toISOString(),
        });
      }

      if (asset === "SILVER") {
        const picked = pickRow(current, ["silver_999"]);
        if (pickRow(current, ["silver_925"]) && !picked) {
          throw new CoreError(
            "price_unavailable",
            "silver_925 cannot price SILVER 999 product",
            503
          );
        }
        const p = picked ? parseIntLoose(picked.row.p) : null;
        if (!p || p < 10_000n) {
          throw new CoreError("price_unavailable", "silver 999 price invalid", 503);
        }
        return quote({
          instrument: "IRAN_SILVER_999_IRR_PER_GRAM",
          asset,
          irrPerGram: p,
          source: picked!.key,
          sourceMode: "TEMPORARY_PUBLIC",
          permittedForProduction: false,
          health: "LIVE",
          observedAt: new Date().toISOString(),
        });
      }

      if (asset === "COPPER") {
        const copper = pickRow(current, ["copper", "base_global_copper"]);
        const dollar = pickRow(current, [
          "price_dollar_rl",
          "price_dollar_dt",
          "price_dollar_afshar",
        ]);
        const usdTonne = copper ? parseIntLoose(copper.row.p) : null;
        const usdIrr = dollar ? parseIntLoose(dollar.row.p) : null;
        if (!usdTonne || usdTonne < 1000n || !usdIrr || usdIrr < 10_000n) {
          throw new CoreError("price_unavailable", "copper theoretical price invalid", 503);
        }
        const irrPerGram = copperIrrPerGram({
          usdPerMetricTonne: usdTonne,
          usdIrr,
        });
        return quote({
          instrument: "GLOBAL_COPPER_THEORETICAL_IRR_PER_GRAM",
          asset,
          irrPerGram,
          source: `${copper!.key}+${dollar!.key}`,
          sourceMode: "TEMPORARY_PUBLIC",
          permittedForProduction: false,
          health: "LIVE",
          observedAt: new Date().toISOString(),
        });
      }

      throw new CoreError("price_unavailable", "TEST_METAL has no public feed", 503);
    },
  };
}

export function displayTomanPerGram(price: PriceQuote): number {
  const toman = price.irrPerGram / 10n;
  if (toman > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  return Number(toman);
}

export function tomanPerGramToIrr(toman: number): Irr {
  if (!Number.isInteger(toman) || toman < 0) {
    throw new CoreError("invalid_price", "display toman must be a non-negative integer");
  }
  return tomanToIrr(toman);
}

export type { PriceHealth };
