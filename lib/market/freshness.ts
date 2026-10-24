/** TGJU stamps `ts` in Tehran local time, without a zone. */
export const SPOT_STALE_AFTER_MS = 2 * 60 * 60 * 1000;
/** Copper prints lag a session or a weekend. Three-month-old series still fail this. */
export const COPPER_STALE_AFTER_MS = 36 * 60 * 60 * 1000;

export function parseTehranTimestamp(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}+03:30`;
  const ms = Date.parse(withZone);
  return Number.isFinite(ms) ? ms : null;
}

export function isTimestampStale(
  raw: unknown,
  maxAgeMs: number,
  now = Date.now()
): boolean {
  const ms = parseTehranTimestamp(raw);
  if (ms == null) return true;
  return now - ms > maxAgeMs;
}

export function observedAtIso(raw: unknown, now = Date.now()): string {
  const ms = parseTehranTimestamp(raw);
  if (ms == null) return new Date(now).toISOString();
  return new Date(ms).toISOString();
}
