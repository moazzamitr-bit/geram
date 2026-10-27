import { describe, expect, it } from "vitest";
import { tradeFailureMessage } from "@/lib/app/trade-errors";

describe("trade failure copy", () => {
  it("translates balance, inventory, and expired price", () => {
    expect(tradeFailureMessage("موجودی کیف پول کافی نیست.", "خطا")).toBe(
      "موجودی کیف پول کافی نیست."
    );
    expect(tradeFailureMessage("insufficient_funds", "خطا")).toBe("موجودی کیف پول کافی نیست.");
    expect(tradeFailureMessage("Not enough metal available to sell", "خطا")).toBe(
      "موجودی فلز کافی نیست."
    );
    expect(tradeFailureMessage("insufficient_inventory", "خطا")).toBe("موجودی فلز کافی نیست.");
    expect(tradeFailureMessage("Quote expired", "خطا")).toBe(
      "اعتبار قیمت تمام شد. قیمت جدید بگیرید."
    );
    expect(tradeFailureMessage("quote_expired", "خطا")).toBe(
      "اعتبار قیمت تمام شد. قیمت جدید بگیرید."
    );
    expect(tradeFailureMessage("price_stale Execution price is stale", "دریافت قیمت ممکن نشد.")).toBe(
      "قیمت لحظه‌ای این فلز الان در دسترس نیست. چند دقیقه دیگر دوباره امتحان کنید."
    );
    expect(tradeFailureMessage("price_unavailable market feed unreachable", "دریافت قیمت ممکن نشد.")).toBe(
      "دریافت قیمت از بازار ممکن نشد. کمی بعد دوباره تلاش کنید."
    );
    expect(tradeFailureMessage("not_executable Temporary public market data", "دریافت قیمت ممکن نشد.")).toBe(
      "این قیمت فعلاً برای خرید و فروش قابل اجرا نیست."
    );
    expect(tradeFailureMessage("insufficient_inventory Not enough metal available to sell", "خطا")).toBe(
      "موجودی فلز کافی نیست."
    );
    expect(tradeFailureMessage("مقدار فلز قابل فروش کافی نیست.", "خطا")).toBe(
      "مقدار فلز قابل فروش کافی نیست."
    );
  });

  it("hides unknown English and keeps other Persian sentences", () => {
    expect(tradeFailureMessage("Idempotency key reused", "خرید انجام نشد.")).toBe(
      "خرید انجام نشد."
    );
    expect(tradeFailureMessage("حداقل خرید ۱۰۰ تومان است.", "خطا")).toBe(
      "حداقل خرید ۱۰۰ تومان است."
    );
    expect(tradeFailureMessage("", "خطا")).toBe("خطا");
  });
});
