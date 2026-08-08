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

const HISTORY_URL =
  "https://api.tgju.org/v1/market/indicator/summary-table/geram18";
const INTRADAY_URL =
  "https://api.tgju.org/v1/market/indicator/today-table-data/geram18?lang=fa";

const cache = new Map<HistoryRange, CacheEntry>();
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

async function fetchDailyHistory(): Promise<HistoryPoint[]> {
  const rows = (await fetchJson(HISTORY_URL)) as DailyRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("empty daily history");
  }

  const points = rows
    .map((row) => {
      const priceRial = parseFaNumber(row.price);
      const ts = Number(row.timestamp);
      if (!priceRial || !Number.isFinite(ts)) return null;
      const jalali = row.jalali_date || row.date || "";
      const short =
        jalali.includes("/") && jalali.split("/").length >= 3
          ? jalali.split("/").slice(1).join("/")
          : jalali;
      return {
        label: toFaDigits(short),
        value: rialToToman(priceRial),
        timestamp: ts * (ts < 1e12 ? 1000 : 1),
      } satisfies HistoryPoint;
    })
    .filter((p): p is HistoryPoint => Boolean(p))
    .sort((a, b) => a.timestamp - b.timestamp);

  return points;
}

async function fetchIntradayHistory(): Promise<HistoryPoint[]> {
  const json = (await fetchJson(INTRADAY_URL)) as {
    data?: Array<[string, string, ...unknown[]]>;
  };
  const rows = json.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("empty intraday history");
  }

  // API returns newest-first; reverse to chronological.
  const chronological = [...rows].reverse();
  const day = new Date();
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();

  const points = chronological
    .map((row) => {
      const priceRial = parseFaNumber(row[0]);
      const time = String(row[1] ?? "");
      const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!priceRial || !match) return null;
      const hh = Number(match[1]);
      const mm = Number(match[2]);
      const ss = Number(match[3] ?? 0);
      const ts = new Date(y, m, d, hh, mm, ss).getTime();
      return {
        label: toFaDigits(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`),
        value: rialToToman(priceRial),
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

let dailyCache: { points: HistoryPoint[]; expiresAt: number } | null = null;

async function getDailyPointsCached() {
  const now = Date.now();
  if (dailyCache && dailyCache.expiresAt > now) return dailyCache.points;
  const points = await fetchDailyHistory();
  dailyCache = { points, expiresAt: now + 10 * 60_000 };
  return points;
}

export async function getGeram18History(
  range: HistoryRange = "7d"
): Promise<{
  points: HistoryPoint[];
  range: HistoryRange;
  unit: "toman_per_gram";
  source: string;
  stale: boolean;
}> {
  const hit = cache.get(range);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    return {
      points: hit.points,
      range,
      unit: "toman_per_gram",
      source: "بازار آزاد",
      stale: false,
    };
  }

  try {
    const points =
      range === "1d"
        ? await fetchIntradayHistory()
        : sliceByRange(await getDailyPointsCached(), range);

    cache.set(range, {
      points,
      expiresAt: now + CACHE_TTL_MS[range],
    });

    return {
      points,
      range,
      unit: "toman_per_gram",
      source: "بازار آزاد",
      stale: false,
    };
  } catch (err) {
    if (hit) {
      return {
        points: hit.points,
        range,
        unit: "toman_per_gram",
        source: "بازار آزاد",
        stale: true,
      };
    }
    console.error("[market] history fetch failed", err);
    return {
      points: [],
      range,
      unit: "toman_per_gram",
      source: "بازار آزاد",
      stale: true,
    };
  }
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
