/** TGJU stamps clocked `ts` values in Tehran local time, without a zone. */
export const SPOT_STALE_AFTER_MS = 2 * 60 * 60 * 1000;
/** Copper prints lag a session or a weekend. Three-month-old series still fail this. */
export const COPPER_STALE_AFTER_MS = 36 * 60 * 60 * 1000;
/**
 * Some TGJU `current` rows (geram18, price_dollar_rl) stamp `ts` at Tehran
 * midnight and put a calendar label in `t_en` (`24 Oct`), while high and low
 * still differ. That midnight is the daily bar's date, not the last tick:
 * on the publication day the price moves and `ts` stays `00:00:00`, so a 2h
 * window blocks trading all afternoon. There is no intraday table for
 * geram18; the live tick series is a different instrument. A midnight bar
 * stays usable until this sanity window, measured from that midnight.
 * Clocked timestamps keep the caller's window. July's frozen copper bar is
 * still stale.
 */
export const DAILY_BAR_MAX_AGE_MS = 48 * 60 * 60 * 1000;

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseTehranTimestamp(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}+03:30`;
  const ms = Date.parse(withZone);
  return Number.isFinite(ms) ? ms : null;
}

/** True when the instant is exactly 00:00:00 in Tehran (no DST). */
export function isTehranMidnight(ms: number): boolean {
  if (!Number.isFinite(ms)) return false;
  const shifted = ms + TEHRAN_OFFSET_MS;
  return ((shifted % DAY_MS) + DAY_MS) % DAY_MS === 0;
}

export function isDateOnlyTehranStamp(raw: unknown): boolean {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}(?:[ T]00:00:00)?$/.test(raw.trim())) return true;
  const ms = parseTehranTimestamp(raw);
  return ms != null && isTehranMidnight(ms);
}

/**
 * Clocked stamps age from their own time. Midnight stamps age from our read
 * (`fetchedAt`, defaulting to `now`) and fail the sanity check when the bar
 * date is older than {@link DAILY_BAR_MAX_AGE_MS} — unless the caller already
 * allows a longer lag, in which case that lag is kept.
 */
export function isTimestampStale(
  raw: unknown,
  maxAgeMs: number,
  now = Date.now(),
  fetchedAt = now
): boolean {
  const ms = parseTehranTimestamp(raw);
  if (ms == null) return true;
  if (isDateOnlyTehranStamp(raw)) {
    if (now - fetchedAt > maxAgeMs) return true;
    if (ms - now > 6 * 60 * 60 * 1000) return true;
    const barLimit = maxAgeMs <= SPOT_STALE_AFTER_MS ? DAILY_BAR_MAX_AGE_MS : maxAgeMs;
    return now - ms > barLimit;
  }
  return now - ms > maxAgeMs;
}

export function observedAtIso(raw: unknown, now = Date.now()): string {
  const ms = parseTehranTimestamp(raw);
  if (ms == null) return new Date(now).toISOString();
  return new Date(ms).toISOString();
}
