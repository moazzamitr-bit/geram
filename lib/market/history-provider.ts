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
    signal: AbortSignal.timeout(90_000),
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
  if (hit) {
    // Stale-while-revalidate: serve the last good series, refresh in background.
    void loadDaily(cacheKey, loader).catch(() => undefined);
    return hit.points;
  }
  return loadDaily(cacheKey, loader);
}

const dailyInflight = new Map<string, Promise<HistoryPoint[]>>();

function loadDaily(cacheKey: string, loader: () => Promise<HistoryPoint[]>) {
  const running = dailyInflight.get(cacheKey);
  if (running) return running;
  const p = loader()
    .then((points) => {
      dailyCache.set(cacheKey, { points, expiresAt: Date.now() + 10 * 60_000 });
      return points;
    })
    .finally(() => dailyInflight.delete(cacheKey));
  dailyInflight.set(cacheKey, p);
  return p;
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
  const [copperRows, dollarHistory] = await Promise.all([
    fetchJson(historyUrl("copper")) as Promise<DailyRow[]>,
    nearestDollarTomanByDay().catch(() => new Map<string, number>()),
  ]);
  let dollarByDay = dollarHistory;
  if (dollarByDay.size === 0) {
    // TGJU's dollar history endpoint is often down (HTTP 500 / hangs). Fall back
    // to the real live dollar print so the copper chart still renders.
    const { getLiveDollarToman } = await import("@/lib/market/price-provider");
    const live = await getLiveDollarToman();
    if (live) dollarByDay = new Map([["__live__", live]]);
  }
  if (!Array.isArray(copperRows) || copperRows.length === 0) {
    throw new Error("empty copper history");
  }

  const knownDollars = [...dollarByDay.values()];
  if (knownDollars.length === 0) {
    throw new Error("dollar history unavailable");
  }
  // A missing day reuses the latest real dollar print. Never invent a rate.
  let lastDollar = knownDollars.at(-1)!;

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

type HistoryResult = {
  points: HistoryPoint[];
  range: HistoryRange;
  instrument: InstrumentId;
  unit: "toman_per_gram";
  source: string;
  stale: boolean;
};

/** A user request waits at most this long on TGJU (often 10–60 s) before getting the last saved series. */
const USER_WAIT_MS = 2_500;
const inflight = new Map<string, Promise<HistoryPoint[]>>();

function result(instrument: InstrumentId, range: HistoryRange, points: HistoryPoint[], stale: boolean): HistoryResult {
  return { points, range, instrument, unit: "toman_per_gram", source: "بازار آزاد", stale };
}

async function readPersisted(cacheKey: string): Promise<{ points: HistoryPoint[]; updatedAt: number } | null> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const { data } = await createServiceClient()
      .from("market_history_cache")
      .select("points, updated_at")
      .eq("key", cacheKey)
      .maybeSingle();
    if (!data || !Array.isArray(data.points)) return null;
    return { points: data.points as HistoryPoint[], updatedAt: new Date(data.updated_at as string).getTime() };
  } catch {
    return null;
  }
}

async function writePersisted(cacheKey: string, points: HistoryPoint[]) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || points.length === 0) return;
    const { createServiceClient } = await import("@/lib/supabase/admin");
    await createServiceClient()
      .from("market_history_cache")
      .upsert({ key: cacheKey, points, updated_at: new Date().toISOString() }, { onConflict: "key" });
  } catch {
    /* the in-memory copy still serves */
  }
}

/** Fetches from TGJU once per key at a time; stores in memory and in the DB. */
function refreshKey(instrument: InstrumentId, range: HistoryRange): Promise<HistoryPoint[]> {
  const cacheKey = `${instrument}:${range}`;
  const running = inflight.get(cacheKey);
  if (running) return running;
  const p = (async () => {
    const points =
      range === "1d"
        ? await loadInstrumentIntraday(instrument)
        : sliceByRange(await loadInstrumentDaily(instrument), range);
    if (points.length === 0) throw new Error("empty history");
    cache.set(cacheKey, { points, expiresAt: Date.now() + CACHE_TTL_MS[range] });
    await writePersisted(cacheKey, points);
    return points;
  })().finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, p);
  p.catch((err) => console.error(`[market] history refresh failed (${cacheKey})`, err?.message ?? err));
  return p;
}

export async function getInstrumentHistory(
  instrumentInput: InstrumentId | string = "gold18",
  range: HistoryRange = "7d",
  opts: { wait?: boolean } = {}
): Promise<HistoryResult> {
  const instrument = parseInstrumentId(String(instrumentInput));
  const cacheKey = `${instrument}:${range}`;
  const now = Date.now();
  let hit = cache.get(cacheKey);

  if (!hit) {
    // Cold process (fresh deploy): the last good series from the DB.
    const saved = await readPersisted(cacheKey);
    if (saved) {
      hit = { points: saved.points, expiresAt: saved.updatedAt + CACHE_TTL_MS[range] };
      cache.set(cacheKey, hit);
    }
  }

  if (hit && hit.expiresAt > now) return result(instrument, range, hit.points, false);

  const refresh = refreshKey(instrument, range);
  if (opts.wait) {
    try {
      return result(instrument, range, await refresh, false);
    } catch {
      return result(instrument, range, hit?.points ?? [], true);
    }
  }
  if (hit) return result(instrument, range, hit.points, true);

  // Nothing saved yet: wait briefly, never the full upstream latency.
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), USER_WAIT_MS));
  const points = await Promise.race([refresh.catch(() => null), timeout]);
  return result(instrument, range, points ?? [], !points);
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

const ALL_RANGES: HistoryRange[] = ["1d", "7d", "1m", "3m", "1y"];

/** Background warmer: refreshes every instrument/range so requests hit cache. */
export async function refreshAllHistory() {
  for (const instrument of ["gold18", "silver925", "copper"] as InstrumentId[]) {
    for (const range of ALL_RANGES) {
      await getInstrumentHistory(instrument, range, { wait: true }).catch(() => undefined);
    }
  }
}
