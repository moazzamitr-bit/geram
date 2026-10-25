"use client";

import { toPersianDigits } from "@/lib/format/digits";
import {
  formatFinnotechBirthDate,
  JALALI_MONTH_NAMES,
  jalaliAdultBirthDays,
  jalaliAdultBirthMonths,
  jalaliAdultBirthYears,
  persianJalaliDate,
  reconcileBirthParts,
  type BirthParts,
} from "@/lib/kyc/jalali";
import { normalizeJalaliBirthDate } from "@/lib/kyc/national-id";
import { useState } from "react";

const selectClass =
  "h-12 w-full rounded-xl border border-black/10 bg-[#F6F4F1] px-2 text-center text-base text-text outline-none transition focus:border-[#FFB800] focus:bg-white";

type Parts = BirthParts;

function split(value: string): Parts {
  const normalized = normalizeJalaliBirthDate(value);
  if (!normalized) return { year: 0, month: 0, day: 0 };
  const [year, month, day] = normalized.split("/").map(Number);
  return { year: year || 0, month: month || 0, day: day || 0 };
}

/**
 * Three native selects. The value sent upstream is Finnotech's
 * `yyyy/mm/dd` ASCII date, or "" until day, month, and year are all chosen.
 */
export function JalaliBirthDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (birthDate: string) => void;
}) {
  const [part, setPart] = useState<Parts>(() => split(value));

  const years = jalaliAdultBirthYears();
  const months = part.year ? jalaliAdultBirthMonths(part.year) : [];
  const days = part.year && part.month
    ? jalaliAdultBirthDays(part.year, part.month)
    : Array.from({ length: part.month ? (part.month <= 6 ? 31 : 30) : 31 }, (_, index) => index + 1);

  const commit = (next: Parts) => {
    const cleaned = reconcileBirthParts(next);
    setPart(cleaned);
    onChange(
      cleaned.year && cleaned.month && cleaned.day
        ? formatFinnotechBirthDate(cleaned.year, cleaned.month, cleaned.day) ?? ""
        : ""
    );
  };

  return (
    <fieldset>
      <legend className="mb-2 text-[13px] text-text-secondary">تاریخ تولد شمسی</legend>
      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label="روز تولد"
          className={selectClass}
          value={part.day || ""}
          onChange={(event) => commit({ ...part, day: Number(event.target.value) || 0 })}
        >
          <option value="">روز</option>
          {days.map((day) => (
            <option key={day} value={day}>
              {toPersianDigits(String(day))}
            </option>
          ))}
        </select>
        <select
          aria-label="ماه تولد"
          className={selectClass}
          value={part.month || ""}
          onChange={(event) => commit({ ...part, month: Number(event.target.value) || 0 })}
        >
          <option value="">ماه</option>
          {JALALI_MONTH_NAMES.map((name, index) => {
            const month = index + 1;
            if (part.year && !months.includes(month)) return null;
            return (
              <option key={name} value={month}>
                {name}
              </option>
            );
          })}
        </select>
        <select
          aria-label="سال تولد"
          className={selectClass}
          value={part.year || ""}
          onChange={(event) => commit({ ...part, year: Number(event.target.value) || 0 })}
        >
          <option value="">سال</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {toPersianDigits(String(year))}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 text-[12px] leading-6 text-muted-app">
        {value
          ? `تاریخ تولد: ${persianJalaliDate(value)}`
          : "روز، ماه و سال را انتخاب کنید. افتتاح حساب از ۱۸ سال تمام امکان‌پذیر است."}
      </p>
    </fieldset>
  );
}
