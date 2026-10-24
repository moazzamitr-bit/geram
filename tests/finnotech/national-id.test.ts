import { describe, expect, it } from "vitest";
import {
  isValidIranianNationalCode,
  maskNationalCode,
  normalizeJalaliBirthDate,
  normalizeNationalCode,
} from "@/lib/kyc/national-id";

describe("iranian national code", () => {
  it("accepts a checksum-valid code and Persian digits", () => {
    expect(isValidIranianNationalCode("0013542419")).toBe(true);
    expect(normalizeNationalCode("۰۰۱۳۵۴۲۴۱۹")).toBe("0013542419");
    expect(isValidIranianNationalCode("۰۰۱۳۵۴۲۴۱۹")).toBe(true);
  });

  it("rejects a bad checksum, the wrong length, and repeated digits", () => {
    expect(isValidIranianNationalCode("0013542418")).toBe(false);
    expect(isValidIranianNationalCode("123456789")).toBe(false);
    expect(isValidIranianNationalCode("0000000000")).toBe(false);
    expect(isValidIranianNationalCode("1111111111")).toBe(false);
  });

  it("masks every digit except the last four", () => {
    expect(maskNationalCode("0013542419")).toBe("••••••2419");
    expect(maskNationalCode("0013542419")).not.toContain("001354");
  });
});

describe("jalali birth date", () => {
  it("normalizes separators and Persian digits", () => {
    expect(normalizeJalaliBirthDate("۱۳۷۰/۶/۱۵")).toBe("1370/06/15");
    expect(normalizeJalaliBirthDate("1370-06-15")).toBe("1370/06/15");
  });

  it("rejects impossible dates", () => {
    expect(normalizeJalaliBirthDate("1370/13/01")).toBeNull();
    expect(normalizeJalaliBirthDate("1200/01/01")).toBeNull();
    expect(normalizeJalaliBirthDate("1370/07/31")).toBeNull();
    expect(normalizeJalaliBirthDate("۱۵ خرداد")).toBeNull();
  });
});
