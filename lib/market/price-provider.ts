import { pickCopperObservation } from "@/lib/core/copper-price";
import {
  isTimestampStale,
  observedAtIso,
  SPOT_STALE_AFTER_MS,
} from "@/lib/market/freshness";
import {
  type InstrumentId,
  parseInstrumentId,
} from "@/lib/market/instruments";

export type MarketPriceQuote = {
  instrument: InstrumentId;
  /** UI unit used across Gram app (تومان per gram) */
  priceToman: number;
  /** Raw IRR-equivalent when available */
  priceRial: number;
  highToman: number | null;
  lowToman: number | null;
  changePercent: number | null;
  source: string;
  sourceKey: string;
  updatedAt: string;
  fetchedAt: string;
  stale: boolean;
};

type CacheEntry = {
  quote: MarketPriceQuote;
  expiresAt: number;
};

const CACHE_TTL_MS = 25_000;
const TGJU_URLS = [
  "https://call1.tgju.org/ajax.json",
  "https://call5.tgju.org/ajax.json",
  "https://call2.tgju.org/ajax.json",
];

const cache = new Map<InstrumentId, CacheEntry>();
let rawCurrentCache: { data: Record<string, unknown>; expiresAt: number } | null =
  null;

function parseFaNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function rialToToman(rial: number) {
  return Math.round(rial / 10);
}

function pickRow(
  current: Record<string, unknown>,
  keys: string[]
): { key: string; row: Record<string, unknown> } | null {
  for (const key of keys) {
    const row = current[key];
    if (row && typeof row === "object") {
      return { key, row: row as Record<string, unknown> };
    }
  }
  return null;
}

async function fetchTgjuCurrent(): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (rawCurrentCache && rawCurrentCache.expiresAt > now) {
    return rawCurrentCache.data;
  }

  if (inflightCurrent) return inflightCurrent;
  // Race every mirror at once; one slow mirror no longer stalls a cold call.
  const ctrl = new AbortController();
  const attempt = async (url: string) => {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "GramPriceBot/1.0" },
      cache: "no-store",
      signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(6_000)]),
    });
    if (!res.ok) throw new Error(`TGJU HTTP ${res.status}`);
    const json = (await res.json()) as { current?: Record<string, unknown> };
    if (!json.current) throw new Error("TGJU payload missing current");
    return json.current;
  };
  inflightCurrent = Promise.any(TGJU_URLS.map(attempt))
    .then((current) => {
      ctrl.abort();
      rawCurrentCache = { data: current, expiresAt: Date.now() + CACHE_TTL_MS };
      return current;
    })
    .catch(() => {
      throw new Error("TGJU unreachable");
    })
    .finally(() => {
      inflightCurrent = null;
    });
  return inflightCurrent;
}

let inflightCurrent: Promise<Record<string, unknown>> | null = null;

/** Keeps the quote cache warm so user requests never wait on TGJU. */
export async function refreshLivePrices() {
  rawCurrentCache = null;
  await getLivePrices(["gold18", "silver925", "copper"]).catch(() => undefined);
}

function quoteFromRialRow(input: {
  instrument: InstrumentId;
  picked: { key: string; row: Record<string, unknown> };
  minRial: number;
  source: string;
}): MarketPriceQuote {
  const priceRial = parseFaNumber(input.picked.row.p);
  if (!priceRial || priceRial < input.minRial) {
    throw new Error(`TGJU ${input.instrument} price invalid`);
  }
  const highRial = parseFaNumber(input.picked.row.h);
  const lowRial = parseFaNumber(input.picked.row.l);
  const changePercent = parseFaNumber(input.picked.row.dp);
  const rawTs = input.picked.row.ts;
  const updatedAt =
    typeof rawTs === "string" && rawTs.trim()
      ? observedAtIso(rawTs)
      : new Date().toISOString();

  return {
    instrument: input.instrument,
    priceToman: rialToToman(priceRial),
    priceRial,
    highToman: highRial ? rialToToman(highRial) : null,
    lowToman: lowRial ? rialToToman(lowRial) : null,
    changePercent,
    source: input.source,
    sourceKey: input.picked.key,
    updatedAt,
    fetchedAt: new Date().toISOString(),
    stale: isTimestampStale(rawTs, SPOT_STALE_AFTER_MS),
  };
}

function usdToTomanPerGram(
  unit: "lb" | "tonne",
  usd: number,
  dollarToman: number
) {
  const toman =
    unit === "lb" ? (usd / 453.59237) * dollarToman : (usd / 1_000_000) * dollarToman;
  return Math.max(1, Math.round(toman));
}

function buildCopperQuote(current: Record<string, unknown>): MarketPriceQuote {
  const copper = pickCopperObservation(current);
  const dollar = pickRow(current, [
    "price_dollar_rl",
    "price_dollar_dt",
    "price_dollar_afshar",
  ]);
  if (!copper || !dollar) {
    throw new Error("TGJU copper/dollar instruments missing");
  }
  const dollarRial = parseFaNumber(dollar.row.p);
  if (!dollarRial || dollarRial < 10_000) {
    throw new Error("TGJU dollar rate invalid");
  }
  const dollarToman = rialToToman(dollarRial);
  const usd = Number(copper.priceMilli) / 1000;
  const highUsd = copper.highMilli == null ? null : Number(copper.highMilli) / 1000;
  const lowUsd = copper.lowMilli == null ? null : Number(copper.lowMilli) / 1000;
  const dollarStale = isTimestampStale(dollar.row.ts, SPOT_STALE_AFTER_MS);

  return {
    instrument: "copper",
    priceToman: usdToTomanPerGram(copper.unit, usd, dollarToman),
    priceRial: usdToTomanPerGram(copper.unit, usd, dollarToman) * 10,
    highToman: highUsd ? usdToTomanPerGram(copper.unit, highUsd, dollarToman) : null,
    lowToman: lowUsd ? usdToTomanPerGram(copper.unit, lowUsd, dollarToman) : null,
    changePercent: copper.changePercent,
    source: "بازار آزاد",
    sourceKey: `${copper.sourceKey}+${dollar.key}`,
    updatedAt: copper.observedAt,
    fetchedAt: new Date().toISOString(),
    stale: copper.stale || dollarStale,
  };
}

function buildQuote(
  instrument: InstrumentId,
  current: Record<string, unknown>
): MarketPriceQuote {
  if (instrument === "gold18") {
    const picked = pickRow(current, [
      "geram18",
      "geram18_buy",
      "tgju_gold_irg18",
      "tgju_gold_irg18_buy",
    ]);
    if (!picked) throw new Error("TGJU 18k instrument missing");
    return quoteFromRialRow({
      instrument,
      picked,
      minRial: 1_000_000,
      source: "بازار آزاد",
    });
  }

  if (instrument === "silver925") {
    const picked = pickRow(current, ["silver_999"]);
    if (!picked) throw new Error("TGJU silver_999 instrument missing");
    return quoteFromRialRow({
      instrument,
      picked,
      minRial: 10_000,
      source: "بازار آزاد",
    });
  }

  return buildCopperQuote(current);
}

function fallbackQuote(instrument: InstrumentId): MarketPriceQuote {
  return {
    instrument,
    priceToman: 0,
    priceRial: 0,
    highToman: null,
    lowToman: null,
    changePercent: null,
    source: "unavailable",
    sourceKey: "unavailable",
    updatedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    stale: true,
  };
}

export async function getLivePrice(
  instrumentInput: InstrumentId | string = "gold18"
): Promise<MarketPriceQuote> {
  const instrument = parseInstrumentId(String(instrumentInput));
  const now = Date.now();
  const hit = cache.get(instrument);
  if (hit && hit.expiresAt > now && rawCurrentCache) return hit.quote;

  try {
    const current = await fetchTgjuCurrent();
    const quote = buildQuote(instrument, current);
    cache.set(instrument, { quote, expiresAt: now + CACHE_TTL_MS });
    return quote;
  } catch (err) {
    if (hit) {
      return {
        ...hit.quote,
        stale: true,
        fetchedAt: new Date().toISOString(),
      };
    }
    console.error(`[market] TGJU fetch failed (${instrument})`, err);
    return fallbackQuote(instrument);
  }
}

export async function getLivePrices(
  instruments: InstrumentId[] = ["gold18", "silver925", "copper"]
): Promise<MarketPriceQuote[]> {
  // One TGJU payload powers all quotes.
  await getLivePrice(instruments[0] ?? "gold18");
  return Promise.all(instruments.map((id) => getLivePrice(id)));
}

/** @deprecated Prefer getLivePrice("gold18") */
export async function getLiveGold18Price(): Promise<MarketPriceQuote> {
  return getLivePrice("gold18");
}

/** Current free-market dollar in toman (from the same live TGJU payload). */
export async function getLiveDollarToman(): Promise<number | null> {
  try {
    const current = await fetchTgjuCurrent();
    const dollar = pickRow(current, ["price_dollar_rl", "price_dollar_dt", "price_dollar_afshar"]);
    const rial = dollar ? parseFaNumber(dollar.row.p) : null;
    return rial && rial >= 10_000 ? rialToToman(rial) : null;
  } catch {
    return null;
  }
}
