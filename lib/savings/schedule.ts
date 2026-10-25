export type Cadence = "DAILY" | "WEEKLY" | "MONTHLY";

/** Plans run at this Tehran wall-clock hour (Iran has no DST since 2022: UTC+3:30). */
export const RUN_HOUR_TEHRAN = 10;
const TEHRAN_OFFSET_MIN = 210;

function tehranParts(d: Date) {
  const t = new Date(d.getTime() + TEHRAN_OFFSET_MIN * 60_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), day: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes() };
}

function tehranAt(y: number, m: number, day: number) {
  return new Date(Date.UTC(y, m, day, RUN_HOUR_TEHRAN, 0) - TEHRAN_OFFSET_MIN * 60_000);
}

/** Monthly: clamp so a plan anchored on the 31st runs on the month's last day. */
function tehranMonthly(y: number, m: number, day: number) {
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return tehranAt(y, m, Math.min(day, last));
}

/** First run: today at 10:00 Tehran if still ahead, else tomorrow. */
export function firstRunAt(now = new Date()): Date {
  const p = tehranParts(now);
  const today = tehranAt(p.y, p.m, p.day);
  return today > now ? today : tehranAt(p.y, p.m, p.day + 1);
}

export function addCadence(from: Date, cadence: Cadence, anchorDay?: number): Date {
  const p = tehranParts(from);
  if (cadence === "DAILY") return tehranAt(p.y, p.m, p.day + 1);
  if (cadence === "WEEKLY") return tehranAt(p.y, p.m, p.day + 7);
  return tehranMonthly(p.y, p.m + 1, anchorDay ?? p.day);
}

/** Next run strictly after `now`, stepping from the scheduled slot (missed slots are skipped, not replayed). */
export function nextRunAfter(scheduled: Date, cadence: Cadence, now = new Date(), anchorDay?: number): Date {
  let next = addCadence(scheduled, cadence, anchorDay);
  for (let i = 0; i < 400 && next <= now; i++) next = addCadence(next, cadence, anchorDay);
  return next;
}

export const CADENCE_LABEL: Record<Cadence, string> = { DAILY: "روزانه", WEEKLY: "هفتگی", MONTHLY: "ماهانه" };
