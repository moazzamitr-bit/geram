/**
 * Fallback price source: Tehran goldsmiths union reference rates (https://www.estjt.ir/price/).
 * Server-side only. Polite: one fetch per ESTJT_CACHE_MS at most, shared across callers.
 * Prices on the page are in TOMAN (verified 2026-10-26 incident: 18k shown as 26,118,500 = toman).
 * We convert to rial here (x10) so every *Rial field is really rial. 18k gold is per gram. No silver/copper on this page.
 */

export const ESTJT_URL = "https://www.estjt.ir/price/";
export const ESTJT_CACHE_MS = 90_000;
/** Fallback kicks in when TGJU fails or its quote is older than this. */
export const DIVERGENCE_WARN_PCT = 1;

export type EstjtSnapshot = {
  gold18Rial: bigint | null;
  gold24Rial: bigint | null;
  mazanehRial: bigint | null;
  coins: { label: string; rial: bigint }[];
  fetchedAt: string;
};

const FA = "۰۱۲۳۴۵۶۷۸۹";
const AR = "٠١٢٣٤٥٦٧٨٩";
function toLatin(s: string) {
  return s.replace(/[۰-۹٠-٩]/g, (d) => String(FA.includes(d) ? FA.indexOf(d) : AR.indexOf(d)));
}
function cellText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function rial(text: string): bigint | null {
  const digits = toLatin(text).replace(/[٬,٫.\s]/g, "");
  return /^\d{4,}$/.test(digits) ? BigInt(digits) * 10n : null; // page is toman -> rial
}

/** Parses the union's reference table rows: first cell = label, second = current rate. */
export function parseEstjtHtml(html: string, now = new Date()): EstjtSnapshot {
  const rows = new Map<string, string>();
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const tds = tr.match(/<td[\s\S]*?<\/td>/gi);
    if (!tds || tds.length < 2) continue;
    rows.set(cellText(tds[0]).replace(/ي/g, "ی").replace(/ك/g, "ک"), cellText(tds[1]));
  }
  const get = (label: string) => {
    const v = rows.get(label);
    return v ? rial(v) : null;
  };
  const coins: EstjtSnapshot["coins"] = [];
  for (const [label, v] of rows) {
    if (!label.includes("سکه")) continue;
    const r = rial(v);
    if (r) coins.push({ label, rial: r });
  }
  const g18 = get("طلای ۱۸ عیار");
  return {
    // Plausibility: 18k gold must be within 10M–80M toman/g (100M–800M rial).
    gold18Rial: g18 && g18 >= 100_000_000n && g18 <= 800_000_000n ? g18 : null,
    gold24Rial: get("طلای ۲۴ عیار"),
    mazanehRial: get("مظنه تهران"),
    coins,
    fetchedAt: now.toISOString(),
  };
}

type G = { __estjt?: { snap: EstjtSnapshot; at: number } | null; __estjtInflight?: Promise<EstjtSnapshot> | null; __tgjuDownUntil?: number; __estjtError?: string | null };
const g = globalThis as unknown as G;

export async function fetchEstjt(): Promise<EstjtSnapshot> {
  const now = Date.now();
  if (g.__estjt && now - g.__estjt.at < ESTJT_CACHE_MS) return g.__estjt.snap;
  if (g.__estjtInflight) return g.__estjtInflight;
  g.__estjtInflight = (async () => {
    try {
      const res = await fetch(ESTJT_URL, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GeramPriceBot/1.0; +https://geram.co)", Accept: "text/html" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`estjt HTTP ${res.status}`);
      const snap = parseEstjtHtml(await res.text());
      if (!snap.gold18Rial) throw new Error("estjt 18k row missing");
      g.__estjt = { snap, at: Date.now() };
      g.__estjtError = null;
      return snap;
    } catch (err) {
      g.__estjtError = err instanceof Error ? err.message : "estjt failed";
      // Back off: keep serving the last good snapshot (marked by its fetchedAt) instead of hammering.
      if (g.__estjt) {
        g.__estjt.at = Date.now() - ESTJT_CACHE_MS + 30_000;
        return g.__estjt.snap;
      }
      throw err;
    } finally {
      g.__estjtInflight = null;
    }
  })();
  return g.__estjtInflight;
}

export function lastEstjtError() {
  return g.__estjtError ?? null;
}

/** Ops drill: make TGJU look down for `minutes` (in-process, auto-expires). */
export function simulateTgjuDown(minutes: number) {
  g.__tgjuDownUntil = minutes > 0 ? Date.now() + Math.min(minutes, 60) * 60_000 : 0;
}
export function tgjuSimulatedDownUntil(): number | null {
  const t = g.__tgjuDownUntil ?? 0;
  return t > Date.now() ? t : null;
}
export function assertTgjuNotSimulatedDown() {
  if (tgjuSimulatedDownUntil()) throw new Error("TGJU simulated down (ops drill)");
}

export function divergencePct(a: bigint | number, b: bigint | number): number {
  const x = Number(a);
  const y = Number(b);
  if (!x || !y) return 0;
  return (Math.abs(x - y) / Math.min(x, y)) * 100;
}
