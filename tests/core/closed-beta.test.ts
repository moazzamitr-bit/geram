import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { walletCreditRefId, walletDebitRefId } from "@/lib/admin/wallet-credit";
import { journalToUi } from "@/lib/core/adapters";
import { tomanToIrr, UG_PER_GRAM } from "@/lib/core/money";
import { PLATFORM_HOLDER } from "@/lib/core/types";
import { makeMemoryCore, makePgCore, makePgLite } from "./helpers";

describe("CLOSED_BETA ledger", () => {
  it("refuses the memory store", () => {
    expect(() => makeMemoryCore({ mode: "CLOSED_BETA", seed: false })).toThrow(/Postgres/);
  });

  it("credits, blocks a negative debit, then quotes and settles", async () => {
    const { store } = await makePgLite();
    const core = makePgCore(store, { mode: "CLOSED_BETA", seed: true });
    const user = "closed-beta-user";
    await core.bootstrap();
    const seeded = await store.getAccount(PLATFORM_HOLDER, "PLATFORM_AVAILABLE", "GOLD");
    expect(seeded?.balance ?? 0n).toBe(0n);

    await core.postApprovedPlatformOpening({
      accountCode: "PLATFORM_AVAILABLE",
      asset: "GOLD",
      amount: UG_PER_GRAM * 10n,
      reason: "closed beta gold inventory",
      refId: "opening-gold-closed-beta",
    });
    await core.creditApprovedUserIrr({
      userId: user,
      amountIrr: tomanToIrr(5_000_000),
      reason: "closed beta invite credit",
      refId: walletCreditRefId("closed-beta-credit"),
    });
    await expect(
      core.debitApprovedUserIrr({
        userId: user,
        amountIrr: tomanToIrr(9_000_000),
        reason: "too large reversal",
        refId: walletDebitRefId("closed-beta-over"),
      })
    ).rejects.toMatchObject({ code: "insufficient_funds" });

    const quote = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(1_000_000),
    });
    const trade = await core.executeTrade({
      userId: user,
      quoteId: quote.id,
      idempotencyKey: "closed-beta-buy-01",
    });
    expect(trade.status).toBe("SETTLED");

    const activity = await core.listActivity(user);
    const credit = activity.journals.find(
      (journal) => journal.refId === walletCreditRefId("closed-beta-credit")
    );
    expect(credit?.refType).toBe("APPROVED_OPENING_BALANCE");
    expect(journalToUi(credit!, user).type).toBe("واریز");
    expect(activity.journals.some((journal) => journal.refType === "trade")).toBe(true);
    const wallet = await core.wallet(user);
    expect(wallet.metals.GOLD.availableUg).toBe(quote.weightUg);
    expect(wallet.rialAvailable).toBeGreaterThan(0n);
  });
});

describe("removed sandbox and public trade routes", () => {
  it("keeps only /app/trade", () => {
    for (const file of [
      "app/api/core/sandbox/deposit/route.ts",
      "app/api/core/sandbox/session/route.ts",
      "app/api/sandbox/kyc/route.ts",
      "app/api/commerce/plus/activate-sandbox/route.ts",
      "app/trade/page.tsx",
      "app/trade/[metal]/page.tsx",
    ]) {
      expect(existsSync(file), file).toBe(false);
    }
    expect(existsSync("app/app/trade/gold") || existsSync("app/app/trade/[metal]/page.tsx")).toBe(true);
  });
});
