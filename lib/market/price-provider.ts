export type MarketPriceQuote = {
  /** UI unit used across Gram app (تومان per gram of 18k gold) */
  priceToman: number;
  /** Raw IRR from provider when available */
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

let cache: CacheEntry | null = null;

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

function pickInstrument(current: Record<string, unknown>) {
  const preferred = [
    "tgju_gold_irg18",
    "tgju_gold_irg18_buy",
    "geram18",
  ];
  for (const key of preferred) {
    const row = current[key];
    if (row && typeof row === "object") return { key, row: row as Record<string, unknown> };
  }
  return null;
}

async function fetchTgju(): Promise<MarketPriceQuote> {
  let lastError: Error | null = null;

  for (const url of TGJU_URLS) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "GramPriceBot/1.0",
        },
        // Always revalidate on server; we manage TTL ourselves.
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
      const picked = pickInstrument(current);
      if (!picked) {
        lastError = new Error("TGJU 18k instrument missing");
        continue;
      }
      const priceRial = parseFaNumber(picked.row.p);
      if (!priceRial || priceRial < 1_000_000) {
        lastError = new Error("TGJU price invalid");
        continue;
      }
      const highRial = parseFaNumber(picked.row.h);
      const lowRial = parseFaNumber(picked.row.l);
      const changePercent = parseFaNumber(picked.row.dp);
      const updatedAt =
        typeof picked.row.ts === "string"
          ? picked.row.ts
          : new Date().toISOString();

      return {
        priceToman: rialToToman(priceRial),
        priceRial,
        highToman: highRial ? rialToToman(highRial) : null,
        lowToman: lowRial ? rialToToman(lowRial) : null,
        changePercent,
        source: "بازار آزاد",
        sourceKey: picked.key,
        updatedAt,
        fetchedAt: new Date().toISOString(),
        stale: false,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("TGJU unreachable");
}

export async function getLiveGold18Price(): Promise<MarketPriceQuote> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.quote;
  }

  try {
    const quote = await fetchTgju();
    cache = { quote, expiresAt: now + CACHE_TTL_MS };
    return quote;
  } catch (err) {
    if (cache) {
      return {
        ...cache.quote,
        stale: true,
        fetchedAt: new Date().toISOString(),
      };
    }
    // Last-resort demo seed so UI still works offline.
    const fallback: MarketPriceQuote = {
      priceToman: 7_012_000,
      priceRial: 70_120_000,
      highToman: null,
      lowToman: null,
      changePercent: null,
      source: "بازار آزاد",
      sourceKey: "seed",
      updatedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      stale: true,
    };
    console.error("[market] TGJU fetch failed", err);
    return fallback;
  }
}
