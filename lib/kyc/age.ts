/** Tehran Jalali date, for the 18-year rule Wallgold and Gerami both publish. */
export function jalaliToday(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Tehran",
  });
  const parts = fmt.formatToParts(now);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const year = num("year");
  const month = num("month");
  const day = num("day");
  if (year < 1300 || month < 1 || day < 1) {
    throw new Error("jalali_calendar_unavailable");
  }
  return { year, month, day };
}

/** `birth` is `yyyy/mm/dd` already normalized. */
export function isAtLeast18Jalali(birth: string, now = new Date()) {
  const [year, month, day] = birth.split("/").map(Number);
  if (!year || !month || !day) return false;
  const today = jalaliToday(now);
  let age = today.year - year;
  if (today.month < month || (today.month === month && today.day < day)) age -= 1;
  return age >= 18;
}
