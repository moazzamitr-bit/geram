import { stripDemoFixtures } from "@/lib/app/demo-fixtures";
import { isLiveDisplayQuote } from "@/lib/market/display-price";
import { describe, expect, it } from "vitest";

describe("user panel demo fixtures", () => {
  it("drops the hard-coded sample trades, goal, bank account, and notifications", () => {
    const cleaned = stripDemoFixtures({
      transactions: [
        { id: "tx-buy-1", trackingCode: "GRM-A1B2C3" },
        { id: "real-1", trackingCode: "GRM-REAL" },
      ],
      goals: [
        { id: "goal-car", name: "خرید خودرو" },
        { id: "goal-real", name: "سفر" },
      ],
      notifications: [
        { id: "n1", title: "خرید با موفقیت انجام شد" },
        { id: "n-real", title: "برداشت ثبت شد" },
      ],
      bankAccounts: [
        { id: "bank-1", iban: "IR120170000000123456789001" },
        { id: "bank-real", iban: "IR990170000000000000000000" },
      ],
    });

    expect(cleaned.transactions).toEqual([{ id: "real-1", trackingCode: "GRM-REAL" }]);
    expect(cleaned.goals).toEqual([{ id: "goal-real", name: "سفر" }]);
    expect(cleaned.notifications).toEqual([{ id: "n-real", title: "برداشت ثبت شد" }]);
    expect(cleaned.bankAccounts).toEqual([
      { id: "bank-real", iban: "IR990170000000000000000000" },
    ]);
  });

  it("does not treat a seed or empty quote as a live price", () => {
    expect(isLiveDisplayQuote({ priceToman: 7_012_000, sourceKey: "seed" })).toBe(false);
    expect(isLiveDisplayQuote({ priceToman: 0, sourceKey: "tgju" })).toBe(false);
    expect(isLiveDisplayQuote({ priceToman: 7_012_000, sourceKey: "unavailable" })).toBe(false);
    expect(isLiveDisplayQuote({ priceToman: 7_012_000, sourceKey: "geram18" })).toBe(true);
  });
});
