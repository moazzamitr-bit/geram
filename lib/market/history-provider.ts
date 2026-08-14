import {
  type InstrumentId,
  parseInstrumentId,
} from "@/lib/market/instruments";

export type HistoryRange = "1d" | "7d" | "1m" | "3m" | "1y";

export type HistoryPoint = {
  label: string;
  value: number; // تومان per gram
  timestamp: number;
};

type CacheEntry = {
  points: HistoryPoint[];
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS: Record<HistoryRange, number> = {
  "1d": 60_000,
  "7d": 5 * 60_000,
  "1m": 10 * 60_000,
  "3m": 15 * 60_000,
  "1y": 30 * 60_000,
};

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

function toFaDigits(input: string) {
  return input.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function downsample<T>(items: T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) return items;
  const out: T[] = [];
  const step = (items.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    out.push(items[Math.round(i * step)]!);
  }
  return out;
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "GramPriceBot/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`history HTTP ${res.status}`);
  return res.json();
}

type DailyRow = {
  price?: string;
  jalali_date?: string;
  date?: string;
  timestamp?: number;
};

function historyUrl(tgjuKey: string) {
  return `https://api.tgju.org/v1/market/indicator/summary-table/${tgjuKey}`;
}

function intradayUrl(tgjuKey: string) {
  return `https://api.tgju.org/v1/market/indicator/today-table-data/${tgjuKey}?lang=fa`;
}

function mapDailyRows(
  rows: DailyRow[],
  mapPrice: (priceRaw: number) => number
): HistoryPoint[] {
  return rows
    .map((row) => {
      const priceRaw = parseFaNumber(row.price);
      const ts = Number(row.timestamp);
      if (!priceRaw || !Number.isFinite(ts)) return null;
      const jalali = row.jalali_date || row.date || "";
      const short =
        jalali.includes("/") && jalali.split("/").length >= 3
          ? jalali.split("/").slice(1).join("/")
          : jalali;
      return {
        label: toFaDigits(short),
        value: mapPrice(priceRaw),
        timestamp: ts * (ts < 1e12 ? 1000 : 1),
      } satisfies HistoryPoint;
    })
    .filter((p): p is HistoryPoint => Boolean(p))
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchDailyMapped(
  tgjuKey: string,
  mapPrice: (priceRaw: number) => number
) {
  const rows = (await fetchJson(historyUrl(tgjuKey))) as DailyRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`empty daily history (${tgjuKey})`);
  }
  return mapDailyRows(rows, mapPrice);
}

async function fetchIntradayMapped(
  tgjuKey: string,
  mapPrice: (priceRaw: number) => number
): Promise<HistoryPoint[]> {
  const json = (await fetchJson(intradayUrl(tgjuKey))) as {
    data?: Array<[string, string, ...unknown[]]>;
  };
  const rows = json.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`empty intraday history (${tgjuKey})`);
  }

  const chronological = [...rows].reverse();
  const day = new Date();
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();

  const points = chronological
    .map((row) => {
      const priceRaw = parseFaNumber(row[0]);
      const time = String(row[1] ?? "");
      const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!priceRaw || !match) return null;
      const hh = Number(match[1]);
      const mm = Number(match[2]);
      const ss = Number(match[3] ?? 0);
      const ts = new Date(y, m, d, hh, mm, ss).getTime();
      return {
        label: toFaDigits(
          `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
        ),
        value: mapPrice(priceRaw),
        timestamp: ts,
      } satisfies HistoryPoint;
    })
    .filter((p): p is HistoryPoint => Boolean(p));

  return downsample(points, 120);
}

function sliceByRange(points: HistoryPoint[], range: HistoryRange) {
  if (range === "1d") return points;
  const now = points.at(-1)?.timestamp ?? Date.now();
  const days =
    range === "7d" ? 7 : range === "1m" ? 31 : range === "3m" ? 93 : 366;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const sliced = points.filter((p) => p.timestamp >= cutoff);
  const maxPoints =
    range === "7d" ? 7 : range === "1m" ? 31 : range === "3m" ? 90 : 120;
  return downsample(sliced.length ? sliced : points.slice(-maxPoints), maxPoints);
}

const dailyCache = new Map<
  string,
  { points: HistoryPoint[]; expiresAt: number }
>();

async function getDailyCached(
  cacheKey: string,
  loader: () => Promise<HistoryPoint[]>
) {
  const now = Date.now();
  const hit = dailyCache.get(cacheKey);
  if (hit && hit.expiresAt > now) return hit.points;
  const points = await loader();
  dailyCache.set(cacheKey, { points, expiresAt: now + 10 * 60_000 });
  return points;
}

async function nearestDollarTomanByDay(): Promise<Map<string, number>> {
  const rows = (await fetchJson(historyUrl("price_dollar_rl"))) as DailyRow[];
  const map = new Map<string, number>();
  for (const row of rows) {
    const priceRial = parseFaNumber(row.price);
    const day = row.date || String(row.timestamp ?? "");
    if (!priceRial || !day) continue;
    map.set(day, rialToToman(priceRial));
  }
  return map;
}

async function fetchCopperDaily(): Promise<HistoryPoint[]> {
  const [copperRows, dollarByDay] = await Promise.all([
    fetchJson(historyUrl("copper")) as Promise<DailyRow[]>,
    nearestDollarTomanByDay(),
  ]);
  if (!Array.isArray(copperRows) || copperRows.length === 0) {
    throw new Error("empty copper history");
  }

  // Fallback dollar if a day is missing: use latest known.
  let lastDollar =
    [...dollarByDay.values()].at(-1) ??
    INSTRUMENT_FALLBACK_DOLLAR_TOMAN;

  return copperRows
    .map((row) => {
      const usdTonne = parseFaNumber(row.price);
      const ts = Number(row.timestamp);
      if (!usdTonne || !Number.isFinite(ts)) return null;
      const day = row.date || "";
      if (day && dollarByDay.has(day)) {
        lastDollar = dollarByDay.get(day)!;
      }
      const jalali = row.jalali_date || row.date || "";
      const short =
        jalali.includes("/") && jalali.split("/").length >= 3
          ? jalali.split("/").slice(1).join("/")
          : jalali;
      return {
        label: toFaDigits(short),
        value: Math.max(1, Math.round((usdTonne / 1_000_000) * lastDollar)),
        timestamp: ts * (ts < 1e12 ? 1000 : 1),
      } satisfies HistoryPoint;
    })
    .filter((p): p is HistoryPoint => Boolean(p))
    .sort((a, b) => a.timestamp - b.timestamp);
}

const INSTRUMENT_FALLBACK_DOLLAR_TOMAN = 187_800;

async function loadInstrumentDaily(instrument: InstrumentId) {
  if (instrument === "gold18") {
    return getDailyCached("gold18", () =>
      fetchDailyMapped("geram18", rialToToman)
    );
  }
  if (instrument === "silver925") {
    return getDailyCached("silver925", () =>
      fetchDailyMapped("silver_925", rialToToman)
    );
  }
  return getDailyCached("copper", fetchCopperDaily);
}

async function loadInstrumentIntraday(instrument: InstrumentId) {
  try {
    if (instrument === "gold18") {
      return await fetchIntradayMapped("geram18", rialToToman);
    }
    if (instrument === "silver925") {
      return await fetchIntradayMapped("silver_925", rialToToman);
    }
    // Copper/silver often lack intraday — fall through.
    throw new Error("no intraday");
  } catch {
    const daily = await loadInstrumentDaily(instrument);
    return sliceByRange(daily, "7d").slice(-24);
  }
}

export async function getInstrumentHistory(
  instrumentInput: InstrumentId | string = "gold18",
  range: HistoryRange = "7d"
): Promise<{
  points: HistoryPoint[];
  range: HistoryRange;
  instrument: InstrumentId;
  unit: "toman_per_gram";
  source: string;
  stale: boolean;
}> {
  const instrument = parseInstrumentId(String(instrumentInput));
  const cacheKey = `${instrument}:${range}`;
  const hit = cache.get(cacheKey);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    return {
      points: hit.points,
      range,
      instrument,
      unit: "toman_per_gram",
      source: "بازار آزاد",
      stale: false,
    };
  }

  try {
    const points =
      range === "1d"
        ? await loadInstrumentIntraday(instrument)
        : sliceByRange(await loadInstrumentDaily(instrument), range);

    cache.set(cacheKey, {
      points,
      expiresAt: now + CACHE_TTL_MS[range],
    });

    return {
      points,
      range,
      instrument,
      unit: "toman_per_gram",
      source: "بازار آزاد",
      stale: false,
    };
  } catch (err) {
    if (hit) {
      return {
        points: hit.points,
        range,
        instrument,
        unit: "toman_per_gram",
        source: "بازار آزاد",
        stale: true,
      };
    }
    console.error(`[market] history fetch failed (${instrument})`, err);
    return {
      points: [],
      range,
      instrument,
      unit: "toman_per_gram",
      source: "بازار آزاد",
      stale: true,
    };
  }
}

/** @deprecated Prefer getInstrumentHistory("gold18", range) */
export async function getGeram18History(range: HistoryRange = "7d") {
  const history = await getInstrumentHistory("gold18", range);
  return {
    points: history.points,
    range: history.range,
    unit: history.unit,
    source: history.source,
    stale: history.stale,
  };
}

export function parseHistoryRange(input: string | null): HistoryRange {
  switch (input) {
    case "1d":
    case "7d":
    case "1m":
    case "3m":
    case "1y":
      return input;
    default:
      return "7d";
  }
}
