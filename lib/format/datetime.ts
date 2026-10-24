/** Jalali date and time in Asia/Tehran, Persian digits. */
export function formatTehranJalaliDateTime(iso: string, fallback = new Date()): string {
  const parsed = new Date(iso);
  const value = Number.isNaN(parsed.getTime()) ? fallback : parsed;
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
