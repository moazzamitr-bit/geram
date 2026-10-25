import { describe, expect, it } from "vitest";
import { isAtLeast18Jalali, jalaliToday } from "@/lib/kyc/age";
import {
  formatFinnotechBirthDate,
  isJalaliLeapYear,
  jalaliAdultBirthDays,
  jalaliAdultBirthMonths,
  jalaliAdultBirthYears,
  jalaliMonthLength,
  JALALI_BIRTH_YEAR_MIN,
  reconcileBirthParts,
} from "@/lib/kyc/jalali";
import { normalizeJalaliBirthDate } from "@/lib/kyc/national-id";

const NOW = new Date("2026-10-24T12:00:00Z");

describe("jalali birth date picker", () => {
  it("uses the 33-year leap cycle for Esfand", () => {
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(isJalaliLeapYear(1399)).toBe(true);
    expect(isJalaliLeapYear(1404)).toBe(false);
    expect(jalaliMonthLength(1403, 1)).toBe(31);
    expect(jalaliMonthLength(1403, 7)).toBe(30);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(jalaliMonthLength(1370, 12)).toBe(30);
  });

  it("offers years from 18 years ago down to 1300", () => {
    const today = jalaliToday(NOW);
    expect(today.year).toBe(1405);
    const years = jalaliAdultBirthYears(NOW);
    expect(years[0]).toBe(today.year - 18);
    expect(years[years.length - 1]).toBe(JALALI_BIRTH_YEAR_MIN);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(years.includes(today.year)).toBe(false);
  });

  it("shortens the newest year to dates that are already 18", () => {
    const today = jalaliToday(NOW);
    const newest = today.year - 18;
    expect(jalaliAdultBirthMonths(newest, NOW)).toEqual(
      Array.from({ length: today.month }, (_, index) => index + 1)
    );
    expect(jalaliAdultBirthDays(newest, today.month, NOW).at(-1)).toBe(today.day);
    const exact = formatFinnotechBirthDate(newest, today.month, today.day, NOW);
    expect(exact).toBe(
      `${newest}/${String(today.month).padStart(2, "0")}/${String(today.day).padStart(2, "0")}`
    );
    expect(isAtLeast18Jalali(exact!, NOW)).toBe(true);
    expect(formatFinnotechBirthDate(newest, today.month, today.day + 1, NOW)).toBeNull();
  });

  it("emits the Finnotech yyyy/mm/dd birth date", () => {
    expect(formatFinnotechBirthDate(1370, 6, 15, NOW)).toBe("1370/06/15");
    expect(jalaliAdultBirthMonths(1370, NOW)).toHaveLength(12);
    expect(jalaliAdultBirthDays(1370, 12, NOW)).toHaveLength(30);
    expect(jalaliAdultBirthDays(1371, 12, NOW)).toHaveLength(29);
    expect(normalizeJalaliBirthDate("1370/06/15")).toBe("1370/06/15");
    expect(normalizeJalaliBirthDate("1403/12/30")).toBe("1403/12/30");
    expect(normalizeJalaliBirthDate("1404/12/30")).toBeNull();
    expect(normalizeJalaliBirthDate("1371/12/30")).toBeNull();
  });
});

describe("birth date parts in any order", () => {
  it("keeps day and month chosen before the year", () => {
    let p = reconcileBirthParts({ year: 0, month: 0, day: 15 }, NOW);
    expect(p).toEqual({ year: 0, month: 0, day: 15 });
    p = reconcileBirthParts({ ...p, month: 7 }, NOW);
    expect(p).toEqual({ year: 0, month: 7, day: 15 });
    p = reconcileBirthParts({ ...p, year: 1370 }, NOW);
    expect(p).toEqual({ year: 1370, month: 7, day: 15 });
    expect(formatFinnotechBirthDate(p.year, p.month, p.day, NOW)).toBe("1370/07/15");
  });
  it("drops impossible days per month and leap year", () => {
    expect(reconcileBirthParts({ year: 0, month: 7, day: 31 }, NOW).day).toBe(0);
    expect(reconcileBirthParts({ year: 1370, month: 12, day: 30 }, NOW).day).toBe(30);
    expect(reconcileBirthParts({ year: 1371, month: 12, day: 30 }, NOW).day).toBe(0);
  });
});
