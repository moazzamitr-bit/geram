import {
  INSTRUMENTS,
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

  let lastError: Error | null = null;
  for (const url of TGJU_URLS) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "GramPriceBot/1.0",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        lastError = new Error(`TGJU HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { current?: Record<string, unknown> };
      const current = json.current;
      if (!current) {
        lastError = new Error("TGJU payload missing current");
        continue;
      }
      rawCurrentCache = { data: current, expiresAt: now + CACHE_TTL_MS };
      return current;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error("TGJU unreachable");
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
  const updatedAt =
    typeof input.picked.row.ts === "string"
      ? input.picked.row.ts
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
    stale: false,
  };
}

function buildCopperQuote(current: Record<string, unknown>): MarketPriceQuote {
  const copper = pickRow(current, ["copper", "base_global_copper"]);
  const dollar = pickRow(current, [
    "price_dollar_rl",
    "price_dollar_dt",
    "price_dollar_afshar",
  ]);
  if (!copper || !dollar) {
    throw new Error("TGJU copper/dollar instruments missing");
  }
  const copperUsdPerTonne = parseFaNumber(copper.row.p);
  const dollarRial = parseFaNumber(dollar.row.p);
  if (!copperUsdPerTonne || copperUsdPerTonne < 1000) {
    throw new Error("TGJU copper USD invalid");
  }
  if (!dollarRial || dollarRial < 10_000) {
    throw new Error("TGJU dollar rate invalid");
  }
  const dollarToman = rialToToman(dollarRial);
  const priceToman = Math.max(
    1,
    Math.round((copperUsdPerTonne / 1_000_000) * dollarToman)
  );

  const highUsd = parseFaNumber(copper.row.h);
  const lowUsd = parseFaNumber(copper.row.l);
  const changePercent = parseFaNumber(copper.row.dp);
  const updatedAt =
    typeof copper.row.ts === "string"
      ? copper.row.ts
      : typeof dollar.row.ts === "string"
        ? dollar.row.ts
        : new Date().toISOString();

  return {
    instrument: "copper",
    priceToman,
    priceRial: priceToman * 10,
    highToman: highUsd
      ? Math.max(1, Math.round((highUsd / 1_000_000) * dollarToman))
      : null,
    lowToman: lowUsd
      ? Math.max(1, Math.round((lowUsd / 1_000_000) * dollarToman))
      : null,
    changePercent,
    source: "بازار آزاد",
    sourceKey: `${copper.key}+${dollar.key}`,
    updatedAt,
    fetchedAt: new Date().toISOString(),
    stale: false,
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
    const picked = pickRow(current, ["silver_925", "silver_999"]);
    if (!picked) throw new Error("TGJU silver instrument missing");
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
  const meta = INSTRUMENTS[instrument];
  return {
    instrument,
    priceToman: meta.fallbackPriceToman,
    priceRial: meta.fallbackPriceToman * 10,
    highToman: null,
    lowToman: null,
    changePercent: null,
    source: "بازار آزاد",
    sourceKey: "seed",
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
  if (hit && hit.expiresAt > now) return hit.quote;

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
