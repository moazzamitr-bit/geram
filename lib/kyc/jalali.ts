import { jalaliToday } from "@/lib/kyc/age";
import { toPersianDigits } from "@/lib/format/digits";

/**
 * Civil Jalali leap years for 1244–1472 follow the 33-year Birashk cycle.
 * 1403 and 1399 are leap; 1404 is not.
 */
export function isJalaliLeapYear(year: number): boolean {
  const remainder = year % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(remainder);
}

/** Farvardin–Shahrivar 31, Mehr–Bahman 30, Esfand 29 or 30. */
export function jalaliMonthLength(year: number, month: number): number {
  if (month >= 1 && month <= 6) return 31;
  if (month >= 7 && month <= 11) return 30;
  if (month === 12) return isJalaliLeapYear(year) ? 30 : 29;
  return 0;
}

export const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/** Oldest birth year offered in the KYC picker. */
export const JALALI_BIRTH_YEAR_MIN = 1300;

export function jalaliAdultBirthYears(now = new Date()): number[] {
  const newest = jalaliToday(now).year - 18;
  const years: number[] = [];
  for (let year = newest; year >= JALALI_BIRTH_YEAR_MIN; year--) years.push(year);
  return years;
}

export function jalaliAdultBirthMonths(year: number, now = new Date()): number[] {
  const today = jalaliToday(now);
  const newest = today.year - 18;
  if (year > newest || year < JALALI_BIRTH_YEAR_MIN) return [];
  const lastMonth = year === newest ? today.month : 12;
  return Array.from({ length: lastMonth }, (_, index) => index + 1);
}

export function jalaliAdultBirthDays(year: number, month: number, now = new Date()): number[] {
  if (!jalaliAdultBirthMonths(year, now).includes(month)) return [];
  const today = jalaliToday(now);
  const length = jalaliMonthLength(year, month);
  const lastDay =
    year === today.year - 18 && month === today.month ? Math.min(length, today.day) : length;
  if (lastDay < 1) return [];
  return Array.from({ length: lastDay }, (_, index) => index + 1);
}

/**
 * Birth date query for Finnotech `identificationInquiry`: `yyyy/mm/dd`
 * (see `lib/finnotech/kyc.ts`). Null unless the civil date is valid and 18+.
 */
export function formatFinnotechBirthDate(
  year: number,
  month: number,
  day: number,
  now = new Date()
): string | null {
  if (!jalaliAdultBirthDays(year, month, now).includes(day)) return null;
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

export function persianJalaliDate(ascii: string): string {
  return toPersianDigits(ascii);
}
