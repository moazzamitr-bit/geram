import { jalaliMonthLength } from "@/lib/kyc/jalali";

const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC = "٠١٢٣٤٥٦٧٨٩";

/** Persian and Arabic-Indic digits become ASCII. Other characters stay. */
export function toEnglishDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const persian = PERSIAN.indexOf(ch);
    if (persian >= 0) return String(persian);
    const arabic = ARABIC.indexOf(ch);
    return arabic >= 0 ? String(arabic) : ch;
  });
}

export function normalizeNationalCode(input: string): string {
  return toEnglishDigits(input).replace(/\D/g, "");
}

/**
 * Iranian national-code checksum.
 * Rejects the wrong length and codes whose digits are all the same
 * (those pass the arithmetic check but are not issued).
 */
export function isValidIranianNationalCode(input: string): boolean {
  const code = normalizeNationalCode(input);
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(code[i]) * (10 - i);
  const remainder = sum % 11;
  const check = Number(code[9]);
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}

/** Last four digits only. Safe for logs, audit rows, and the admin list. */
export function maskNationalCode(input: string): string {
  const code = normalizeNationalCode(input);
  if (code.length < 4) return "••••";
  return `${"•".repeat(code.length - 4)}${code.slice(-4)}`;
}

/**
 * Jalali birth date as `yyyy/mm/dd` for Finnotech identification inquiry.
 * Accepts `/`, `-`, or `.` separators and Persian digits.
 */
export function normalizeJalaliBirthDate(input: string): string | null {
  const ascii = toEnglishDigits(input).trim().replace(/[-.]/g, "/");
  const match = ascii.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1300 || year > 1410) return null;
  if (month < 1 || month > 12) return null;
  const maxDay = jalaliMonthLength(year, month);
  if (day < 1 || day > maxDay) return null;
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}
