import { describe, expect, it } from "vitest";
import {
  amountCanonical,
  editAmount,
  formatAmountValue,
  parseGroupedAmount,
  tomanInWords,
} from "@/lib/format/amount";

describe("amount formatter", () => {
  it("parses Persian, Arabic, and pasted separators into a clean number", () => {
    expect(parseGroupedAmount("۱٬۲۳۴", 0)).toMatchObject({ canonical: "1234", value: 1234 });
    expect(parseGroupedAmount("١٬٢٣٤", 0).value).toBe(1234);
    expect(parseGroupedAmount("1,234,567", 0).value).toBe(1234567);
    expect(parseGroupedAmount("1 234", 0).value).toBe(1234);
    expect(parseGroupedAmount("۱،۲۳۴", 0).value).toBe(1234);
    expect(parseGroupedAmount("", 0)).toMatchObject({ canonical: "", value: 0 });
  });

  it("groups with ٬ while typing and keeps the caret on the same digit", () => {
    const typed = editAmount("1234567", 7, { decimals: 0, digits: "fa" });
    expect(typed.text).toBe("۱٬۲۳۴٬۵۶۷");
    expect(typed.caret).toBe(typed.text.length);
    expect(typed.value).toBe(1234567);

    const middle = editAmount("1234567", 2, { decimals: 0, digits: "fa" });
    expect(middle.text).toBe("۱٬۲۳۴٬۵۶۷");
    expect(middle.text.slice(0, middle.caret)).toBe("۱٬۲");

    const inserted = editAmount("۱۹٬۲۳۴", 2, { decimals: 0, digits: "fa" });
    expect(inserted.value).toBe(19234);
    expect(inserted.text.slice(0, inserted.caret)).toBe("۱۹");
  });

  it("keeps one decimal for grams and drops fractions from toman", () => {
    expect(editAmount("12.5", 4, { decimals: 3, digits: "fa" })).toMatchObject({
      canonical: "12.5",
      value: 12.5,
      text: "۱۲٫۵",
    });
    expect(editAmount("12.", 3, { decimals: 3, digits: "fa" }).canonical).toBe("12.");
    expect(editAmount("12.3456", 7, { decimals: 3, digits: "fa" }).canonical).toBe("12.345");
    expect(editAmount("1,234.90", 8, { decimals: 0, digits: "fa" })).toMatchObject({
      canonical: "1234",
      value: 1234,
      text: "۱٬۲۳۴",
    });
    expect(editAmount("1234.5", 6, { decimals: 2, digits: "en" }).text).toBe("1٬234.5");
  });

  it("formats committed values and strips grouping for the API", () => {
    expect(formatAmountValue(1_500_000)).toBe("۱٬۵۰۰٬۰۰۰");
    expect(formatAmountValue(0)).toBe("");
    expect(formatAmountValue(12.5, { decimals: 3 })).toBe("۱۲٫۵");
    expect(amountCanonical(50_000_000, 0)).toBe("50000000");
    expect(amountCanonical(1.5, 6)).toBe("1.5");
    expect(amountCanonical(0, 0)).toBe("");
  });

  it("spells large toman amounts", () => {
    expect(tomanInWords(50_000_000)).toBe("پنجاه میلیون تومان");
    expect(tomanInWords(1_234_000)).toBe("یک میلیون و دویست و سی و چهار هزار تومان");
    expect(tomanInWords(1_000_000_000)).toBe("یک میلیارد تومان");
    expect(tomanInWords(999)).toBe("");
    expect(tomanInWords(0)).toBe("");
  });
});
