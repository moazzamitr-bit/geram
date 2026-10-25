import { describe, expect, it } from "vitest";
import { journalToUi, serializeTrade } from "@/lib/core/adapters";
import { irrToSafeTomanNumber, tomanToIrr, UG_PER_GRAM } from "@/lib/core/money";
import type { Quote, Trade } from "@/lib/core/types";
import { makeMemoryCore } from "./helpers";

describe("trade response price per gram", () => {
  it("returns the executed toman price for buy and sell", async () => {
    const { core } = makeMemoryCore({
      spread: { buySpreadBps: 0n, sellSpreadBps: 0n },
    });
    const user = "price-user";
    await core.sandboxDeposit(user, tomanToIrr(20_000_000), "dep");

    const buyQuote = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "METAL_WEIGHT",
      requestedWeightUg: UG_PER_GRAM,
    });
    const buy = await core.executeTrade({
      userId: user,
      quoteId: buyQuote.id,
      idempotencyKey: "buy",
    });
    const buyToman = irrToSafeTomanNumber(buyQuote.executionPriceIrrPerGram);
    expect(buyToman).toBeGreaterThan(0);
    expect(serializeTrade(buy, buyQuote).ui.pricePerGram).toBe(buyToman);
    expect(serializeTrade(buy).ui.pricePerGram).toBe(buyToman);

    const sellQuote = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "SELL",
      inputMode: "METAL_WEIGHT",
      requestedWeightUg: buy.weightUg,
    });
    const sell = await core.executeTrade({
      userId: user,
      quoteId: sellQuote.id,
      idempotencyKey: "sell",
    });
    const sellToman = irrToSafeTomanNumber(sellQuote.executionPriceIrrPerGram);
    expect(sellToman).toBeGreaterThan(0);
    expect(serializeTrade(sell, sellQuote).ui.pricePerGram).toBe(sellToman);
    expect(serializeTrade(sell).ui.pricePerGram).toBe(sellToman);

    const { journals } = await core.listActivity(user);
    expect(journalToUi(journals.find((row) => row.reason === "BUY_SETTLE")!, user).pricePerGram).toBe(
      buyToman
    );
    expect(journalToUi(journals.find((row) => row.reason === "SELL_SETTLE")!, user).pricePerGram).toBe(
      sellToman
    );
  });

  it("prefers the locked execution price over a rounded metal leg", () => {
    const trade: Trade = {
      id: "trd",
      userId: "user",
      quoteId: "q",
      asset: "GOLD",
      side: "BUY",
      status: "SETTLED",
      weightUg: 1n,
      grossIrr: 11n,
      feeIrr: 0n,
      netIrr: 11n,
      idempotencyKey: "k",
      createdAt: "2026-10-25T00:00:00.000Z",
      trackingCode: "GRM-DC8AA9",
    };
    const quote = { id: "q", executionPriceIrrPerGram: 10_000_007n } as Quote;
    const locked = serializeTrade(trade, quote).ui.pricePerGram;
    const derived = serializeTrade(trade).ui.pricePerGram;
    expect(locked).toBe(irrToSafeTomanNumber(10_000_007n));
    expect(derived).toBeGreaterThan(0);
    expect(derived).not.toBe(locked);
  });
});
