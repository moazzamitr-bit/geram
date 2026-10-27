/**
 * Competitor 18k gold price monitor — INFORMATIONAL ONLY.
 * Never imported by the trading engine or price guard. Read-only public endpoints,
 * polled at most every 5 minutes server-side, no login, no private data.
 * Endpoints learned from github.com/sepehr071/iran-gold-mcp (reference only; reimplemented here).
 * All values are normalized to TOMAN per gram of 18k gold.
 */

export type CompetitorId = "milli" | "wallgold" | "melligold" | "daric" | "taline" | "gerami";
export type BuySell = { buy: number; sell: number };

export type CompetitorDef = {
  id: CompetitorId;
  name: string;
  site: string;
  url: string;
  /** Raw unit the endpoint uses — documented so a 10x slip is caught in review and tests. */
  unit: string;
  text?: boolean;
  parse: (body: unknown) => BuySell;
};

/** Toman per gram sanity band (same 10M–80M as the trading guard). A rial/toman slip lands outside. */
export const COMPETITOR_BAND_TOMAN: readonly [number, number] = [10_000_000, 80_000_000];
/** A buy/sell gap wider than this is not a real 18k quote. */
export const MAX_SPREAD_PCT = 8;
export const POLL_MS = 5 * 60_000;
export const STALE_AFTER_MS = 15 * 60_000;
export const FETCH_TIMEOUT_MS = 8_000;
export const RETENTION_DAYS = 30;

export class CompetitorError extends Error {}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  if (!Number.isFinite(n) || n <= 0) throw new CompetitorError("قیمت در پاسخ نبود");
  return Math.round(n);
}
const get = (o: unknown, k: string): unknown => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined);

export function parseMilli(body: unknown): BuySell {
  if (get(body, "code") !== 0) throw new CompetitorError("پاسخ نامعتبر");
  // price18 is RIAL per MILLIGRAM → ×1000 mg/g ÷10 rial/toman = ×100 toman/g
  const p = num(get(get(body, "data"), "price18")) * 100;
  return { buy: p, sell: p };
}
export function parseWallgold(body: unknown): BuySell {
  const rows = get(body, "result");
  const side: Record<string, unknown> = {};
  if (Array.isArray(rows)) for (const r of rows) if (get(r, "symbol") === "GLD_18C_750TMN") side[String(get(r, "side"))] = get(r, "price");
  return { buy: num(side.buy), sell: num(side.sell) }; // symbol suffix TMN = toman/g
}
export function parseMelligold(body: unknown): BuySell {
  const d = get(body, "data");
  return { buy: num(get(d, "price_buy")), sell: num(get(d, "price_sell")) }; // toman/g
}
export function parseDaric(body: unknown): BuySell {
  const d = get(body, "Data");
  // Order book: user buys at best ask (BestSellPrice), sells at best bid (BestBuyPrice). toman/g
  return { buy: num(get(d, "BestSellPrice")), sell: num(get(d, "BestBuyPrice")) };
}
export function parseTaline(html: unknown): BuySell {
  const m = /goldPrices\s*=\s*\{\s*buy:\s*(\d+),\s*sell:\s*(\d+)/.exec(String(html));
  if (!m) throw new CompetitorError("قیمت در صفحه پیدا نشد");
  if (m[1] === "0" && m[2] === "0") throw new CompetitorError("قیمت صفر (فقط برای IP ایران)");
  return { buy: num(m[1]), sell: num(m[2]) }; // toman/g
}
export function parseGerami(html: unknown): BuySell {
  // Homepage embeds its market list (escaped JSON). Market XAU750g_IRT, quote IRT = toman/g.
  const s = String(html).replace(/\\"/g, '"');
  const i = s.indexOf('"market":"XAU750g_IRT"');
  if (i < 0) throw new CompetitorError("بازار XAU750g_IRT در صفحه پیدا نشد");
  const chunk = s.slice(i, i + 1500);
  const b = /"buy_price":"?([\d.]+)/.exec(chunk);
  const se = /"sell_price":"?([\d.]+)/.exec(chunk);
  return { buy: num(b?.[1]), sell: num(se?.[1]) };
}

export const COMPETITORS: CompetitorDef[] = [
  { id: "milli", name: "میلی", site: "https://milli.gold", url: "https://milli.gold/api/v1/public/milli-price/external", unit: "rial/mg", parse: parseMilli },
  { id: "wallgold", name: "وال‌گلد", site: "https://wallgold.ir", url: "https://api.wallgold.ir/api/v1/prices", unit: "toman/g", parse: parseWallgold },
  { id: "melligold", name: "ملی‌گلد", site: "https://melligold.com", url: "https://melligold.com/api/v1/exchange/buy-sell-price/?symbol=XAU18&format=json", unit: "toman/g", parse: parseMelligold },
  { id: "daric", name: "داریک", site: "https://daric.gold", url: "https://apisc.daric.gold/loan/api/v1/User/Collateral/GetGoldlPrice", unit: "toman/g", parse: parseDaric },
  { id: "taline", name: "طلاین", site: "https://taline.ir", url: "https://taline.ir/", unit: "toman/g", text: true, parse: parseTaline },
  { id: "gerami", name: "گرمی", site: "https://gerami.com", url: "https://gerami.com/", unit: "toman/g", text: true, parse: parseGerami },
];

/** Sanity checks after unit normalization. Throws on anything implausible. */
export function validate(q: BuySell): BuySell {
  const [lo, hi] = COMPETITOR_BAND_TOMAN;
  for (const v of [q.buy, q.sell]) {
    if (!(v >= lo && v <= hi)) throw new CompetitorError(`خارج از بازه منطقی (${v.toLocaleString("en")} تومان) — احتمال خطای واحد`);
  }
  if (q.sell > q.buy * 1.001) throw new CompetitorError("قیمت فروش از خرید بیشتر است");
  if (((q.buy - q.sell) / q.buy) * 100 > MAX_SPREAD_PCT) throw new CompetitorError("فاصله خرید و فروش غیرعادی");
  return q;
}

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

async function fetchBody(def: CompetitorDef, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  let cookie = "";
  // Arvan edge (melligold) answers 307 + cookie on first hit; follow once with the cookie.
  for (let hop = 0; hop < 3; hop++) {
    const res = await fetchImpl(def.url, {
      headers: { "User-Agent": UA, Accept: def.text ? "text/html" : "application/json, text/plain, */*", ...(cookie ? { Cookie: cookie } : {}) },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const sc = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
      cookie = sc.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
      continue;
    }
    if (!res.ok) throw new CompetitorError(`HTTP ${res.status}`);
    return def.text ? await res.text() : await res.json();
  }
  throw new CompetitorError("ریدایرکت بیش از حد");
}

export type CompetitorReading = {
  id: CompetitorId;
  name: string;
  site: string;
  /** last good values (may be older than the last attempt) */
  buy: number | null;
  sell: number | null;
  observedAt: string | null;
  lastAttemptAt: string;
  error: string | null;
};

export async function readCompetitor(def: CompetitorDef, fetchImpl?: typeof fetch): Promise<BuySell> {
  try {
    return validate(def.parse(await fetchBody(def, fetchImpl)));
  } catch (e) {
    if (e instanceof CompetitorError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new CompetitorError(/timeout|abort/i.test(msg) ? "پاسخ نداد (timeout)" : `خطای شبکه: ${msg.slice(0, 80)}`);
  }
}

type Store = { readings: Map<CompetitorId, CompetitorReading>; refreshedAt: number; inflight: Promise<void> | null };
const g = globalThis as unknown as { __geramCompetitors?: Store };
const store = (): Store => (g.__geramCompetitors ??= { readings: new Map(), refreshedAt: 0, inflight: null });

export type SnapshotSink = (rows: { competitor: CompetitorId; buy_toman: number; sell_toman: number; observed_at: string }[]) => Promise<void>;

/** Poll all competitors (at most once per POLL_MS unless forced). Failures are isolated per competitor. */
export async function refreshCompetitors(opts: { force?: boolean; sink?: SnapshotSink; fetchImpl?: typeof fetch } = {}) {
  const s = store();
  if (!opts.force && Date.now() - s.refreshedAt < POLL_MS) return;
  if (s.inflight) return s.inflight;
  s.inflight = (async () => {
    const now = new Date().toISOString();
    const results = await Promise.allSettled(COMPETITORS.map((d) => readCompetitor(d, opts.fetchImpl)));
    const rows: Parameters<SnapshotSink>[0] = [];
    COMPETITORS.forEach((d, i) => {
      const r = results[i];
      const prev = s.readings.get(d.id);
      if (r.status === "fulfilled") {
        s.readings.set(d.id, { id: d.id, name: d.name, site: d.site, buy: r.value.buy, sell: r.value.sell, observedAt: now, lastAttemptAt: now, error: null });
        rows.push({ competitor: d.id, buy_toman: r.value.buy, sell_toman: r.value.sell, observed_at: now });
      } else {
        const err = r.reason instanceof Error ? r.reason.message : "خطا";
        s.readings.set(d.id, { id: d.id, name: d.name, site: d.site, buy: prev?.buy ?? null, sell: prev?.sell ?? null, observedAt: prev?.observedAt ?? null, lastAttemptAt: now, error: err });
      }
    });
    s.refreshedAt = Date.now();
    if (opts.sink && rows.length) await opts.sink(rows).catch((e) => console.error("[competitors] snapshot", e));
  })().finally(() => {
    s.inflight = null;
  });
  return s.inflight;
}

export type CompetitorStatus = "ok" | "stale" | "error";
export function statusOf(r: CompetitorReading, now = Date.now()): CompetitorStatus {
  if (r.buy == null || !r.observedAt) return "error";
  if (r.error || now - Date.parse(r.observedAt) > STALE_AFTER_MS) return "stale";
  return "ok";
}

export function getCompetitorReadings(): CompetitorReading[] {
  const s = store();
  return COMPETITORS.map(
    (d) => s.readings.get(d.id) ?? { id: d.id, name: d.name, site: d.site, buy: null, sell: null, observedAt: null, lastAttemptAt: "", error: "هنوز خوانده نشده" }
  );
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}
export function average(xs: number[]): number | null {
  return xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null;
}

/** Geram minus competitor. For BUY, negative = we are cheaper for the user (good). For SELL, positive = we pay more (good). */
export function compare(side: "buy" | "sell", geram: number, theirs: number) {
  const diff = geram - theirs;
  const pct = (diff / theirs) * 100;
  const good = side === "buy" ? diff < 0 : diff > 0;
  return { diff, pct, good, equal: diff === 0 };
}

/** What a user effectively pays / receives per gram after Geram's spread + fee (bps). */
export function effectivePerGram(reference: number, side: "buy" | "sell", spreadBps: number, feeBps: number) {
  if (side === "buy") {
    const exec = reference + Math.floor((reference * spreadBps) / 10_000);
    return Math.round(exec / (1 - feeBps / 10_000));
  }
  const exec = reference - Math.floor((reference * spreadBps) / 10_000);
  return Math.round(exec * (1 - feeBps / 10_000));
}
