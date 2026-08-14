import { describe, expect, it } from "vitest";
import { FinancialCore } from "@/lib/core/engine";
import { MemoryCoreStore } from "@/lib/core/store";
import { line, postJournal, reconcileAllLedgerBalances, recomputeAccountBalanceFromJournal } from "@/lib/core/ledger";
import { CoreError, PLATFORM_HOLDER } from "@/lib/core/types";
import { staticPriceFeed } from "@/lib/core/price";
import { tomanToIrr } from "@/lib/core/money";
import { assertAccountPolicy } from "@/lib/core/account-policy";
import { CONSERVATIVE_FLAGS } from "@/lib/core/mode";
import { makeMemoryCore, makePgCore, makePgLite, TEST_PRICES, sandboxFlags } from "./helpers";

describe("production never auto-seeds", () => {
  it("PRODUCTION postgres bootstrap leaves metal and cash at 0 even if seed amounts are passed", async () => {
    const { store } = await makePgLite();
    const core = makePgCore(store, { mode: "PRODUCTION", seed: true });
    await core.bootstrap();
    const gold = await store.getAccount(PLATFORM_HOLDER, "PLATFORM_AVAILABLE", "GOLD");
    const silver = await store.getAccount(PLATFORM_HOLDER, "PLATFORM_AVAILABLE", "SILVER");
    const copper = await store.getAccount(PLATFORM_HOLDER, "PLATFORM_AVAILABLE", "COPPER");
    const cash = await store.getAccount(PLATFORM_HOLDER, "PLATFORM_CASH_CONTROL", "IRR");
    expect(gold?.balance ?? 0n).toBe(0n);
    expect(silver?.balance ?? 0n).toBe(0n);
    expect(copper?.balance ?? 0n).toBe(0n);
    expect(cash?.balance ?? 0n).toBe(0n);
  });

  it("SYSTEM_SEED is rejected in PRODUCTION", async () => {
    const { store } = await makePgLite();
    const core = makePgCore(store, { mode: "PRODUCTION" });
    await expect(
      core.postOpening({
        accountCode: "PLATFORM_AVAILABLE",
        asset: "GOLD",
        amount: 1n,
        refType: "SYSTEM_SEED",
      })
    ).rejects.toMatchObject({ code: "opening_forbidden" });
  });

  it("SANDBOX without SANDBOX_SEED_ENABLED does not seed inventory", async () => {
    const { core, store } = makeMemoryCore({ seed: false, flags: sandboxFlags(false) });
    await core.bootstrap();
    const gold = await store.getAccount(PLATFORM_HOLDER, "PLATFORM_AVAILABLE", "GOLD");
    expect(gold?.balance ?? 0n).toBe(0n);
  });
});

describe("MemoryCoreStore rejected outside sandbox", () => {
  it("CLOSED_BETA cannot use MemoryCoreStore", () => {
    expect(() => {
      new FinancialCore({
        store: new MemoryCoreStore(),
        prices: staticPriceFeed(TEST_PRICES),
        mode: "CLOSED_BETA",
        flags: CONSERVATIVE_FLAGS,
      });
    }).toThrow(/Postgres/);
  });

  it("PRODUCTION cannot use MemoryCoreStore", () => {
    expect(() => {
      new FinancialCore({
        store: new MemoryCoreStore(),
        prices: staticPriceFeed(TEST_PRICES),
        mode: "PRODUCTION",
      });
    }).toThrow(/Postgres/);
  });
});

describe("opening account guard", () => {
  it("rejects PLATFORM_OPENING on a runtime TRADE journal", async () => {
    const store = new MemoryCoreStore();
    await expect(
      postJournal(store, {
        id: "j1",
        createdAt: new Date().toISOString(),
        reason: "BUY_SETTLE",
        refType: "trade",
        refId: "t1",
        lines: [
          line("PLATFORM_OPENING", PLATFORM_HOLDER, "IRR", 100n, 0n),
          line("USER_AVAILABLE", "u1", "IRR", 0n, 100n),
        ],
      })
    ).rejects.toMatchObject({ code: "opening_forbidden" });
  });

  it("allows APPROVED_OPENING_BALANCE", async () => {
    const { core, store } = makeMemoryCore({ seed: false, flags: sandboxFlags(false) });
    await core.postOpening({
      accountCode: "PLATFORM_AVAILABLE",
      asset: "GOLD",
      amount: 50n,
      refType: "APPROVED_OPENING_BALANCE",
    });
    const gold = await store.getAccount(PLATFORM_HOLDER, "PLATFORM_AVAILABLE", "GOLD");
    expect(gold?.balance).toBe(50n);
  });
});

describe("idempotency semantics", () => {
  it("replays the same key + same quote", async () => {
    const { core } = makeMemoryCore();
    const user = "idem-same";
    await core.sandboxDeposit(user, tomanToIrr(20_000_000), "d");
    const q = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(2_000_000),
    });
    const a = await core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "k" });
    const b = await core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "k" });
    expect(a.id).toBe(b.id);
  });

  it("conflicts when the same key is reused for a different quote", async () => {
    const { core } = makeMemoryCore();
    const user = "idem-diff";
    await core.sandboxDeposit(user, tomanToIrr(40_000_000), "d");
    const q1 = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(2_000_000),
    });
    const q2 = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(2_000_000),
    });
    await core.executeTrade({ userId: user, quoteId: q1.id, idempotencyKey: "shared" });
    await expect(
      core.executeTrade({ userId: user, quoteId: q2.id, idempotencyKey: "shared" })
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
  });

  it("concurrent same-key requests execute once", async () => {
    const { core } = makeMemoryCore();
    const user = "idem-conc";
    await core.sandboxDeposit(user, tomanToIrr(20_000_000), "d");
    const q = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(2_000_000),
    });
    const results = await Promise.allSettled([
      core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "once" }),
      core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "once" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected");
    expect(ok.length + fail.length).toBe(2);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const ids = ok.map((r) => (r as PromiseFulfilledResult<{ id: string }>).value.id);
    expect(new Set(ids).size).toBe(1);
    const w = await core.wallet(user);
    expect(w.metals.GOLD.availableUg).toBe(q.weightUg);
  });
});

describe("one settled trade per quote", () => {
  it("rejects a second successful trade on the same quote", async () => {
    const { core } = makeMemoryCore();
    const user = "one-quote";
    await core.sandboxDeposit(user, tomanToIrr(20_000_000), "d");
    const q = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(2_000_000),
    });
    const first = await core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "a" });
    expect(first.status).toBe("SETTLED");
    await expect(
      core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "b" })
    ).rejects.toBeInstanceOf(CoreError);
  });
});

describe("failed transaction rolls back financial state", () => {
  it("rolls back ledger, journal, trade, quote, reservation, outbox, and idempotency", async () => {
    const { core, store } = makeMemoryCore();
    const orig = store.insertOutbox.bind(store);
    store.insertOutbox = async (event) => {
      if (event.topic === "trade.settled") throw new Error("forced-outbox-failure");
      return orig(event);
    };
    const user = "rollback-user";
    await core.sandboxDeposit(user, tomanToIrr(20_000_000), "d");
    const q = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(2_000_000),
    });
    const rialBefore = (await core.wallet(user)).rialAvailable;
    const journalsBefore = (await store.listJournals()).length;
    await expect(
      core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "rb" })
    ).rejects.toThrow(/forced-outbox-failure/);
    const qAfter = await store.getQuote(q.id);
    expect(qAfter?.status).toBe("ACTIVE");
    expect(await store.getSettledTradeByQuote(q.id)).toBeNull();
    expect((await core.wallet(user)).rialAvailable).toBe(rialBefore);
    expect((await store.listJournals()).length).toBe(journalsBefore);
    expect(await store.getIdempotency(user, "TRADE_EXECUTE", "rb")).toBeNull();
    const res = await store.getReservationByQuote(q.id);
    expect(res?.status).toBe("OPEN");
  });
});

describe("balance cache is a journal projection", () => {
  it("recomputes cached balances exactly from journals", async () => {
    const { core, store } = makeMemoryCore();
    const user = "recon-user";
    await core.sandboxDeposit(user, tomanToIrr(5_000_000), "d");
    const q = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(1_000_000),
    });
    await core.executeTrade({ userId: user, quoteId: q.id, idempotencyKey: "k" });
    const recon = await reconcileAllLedgerBalances(store);
    expect(recon.ok).toBe(true);
    expect(recon.mismatches).toEqual([]);
    const userIrr = await recomputeAccountBalanceFromJournal(
      store,
      user,
      "USER_AVAILABLE",
      "IRR"
    );
    expect(userIrr.matches).toBe(true);
  });
});

describe("journal line application constraints", () => {
  it("rejects 0/0 and debit+credit lines", async () => {
    const store = new MemoryCoreStore();
    await expect(
      postJournal(store, {
        id: "bad-zero",
        createdAt: new Date().toISOString(),
        reason: "TEST",
        refType: "test",
        refId: "x",
        lines: [
          line("USER_AVAILABLE", "u", "IRR", 0n, 0n),
          line("PAYMENT_GATEWAY_CLEARING", PLATFORM_HOLDER, "IRR", 0n, 0n),
        ],
      })
    ).rejects.toMatchObject({ code: "invalid_journal" });
    await expect(
      postJournal(store, {
        id: "bad-both",
        createdAt: new Date().toISOString(),
        reason: "TEST",
        refType: "test",
        refId: "x",
        lines: [
          line("USER_AVAILABLE", "u", "IRR", 5n, 5n),
          line("PAYMENT_GATEWAY_CLEARING", PLATFORM_HOLDER, "IRR", 5n, 0n),
        ],
      })
    ).rejects.toMatchObject({ code: "invalid_journal" });
  });

  it("rejects unbalanced IRR, unbalanced GOLD, and cross-asset fake balance", async () => {
    const store = new MemoryCoreStore();
    await expect(
      postJournal(store, {
        id: "unb-irr",
        createdAt: new Date().toISOString(),
        reason: "TEST",
        refType: "test",
        refId: "x",
        lines: [
          line("USER_AVAILABLE", "u", "IRR", 0n, 10n),
          line("PAYMENT_GATEWAY_CLEARING", PLATFORM_HOLDER, "IRR", 7n, 0n),
        ],
      })
    ).rejects.toMatchObject({ code: "unbalanced_journal" });
    await expect(
      postJournal(store, {
        id: "unb-gold",
        createdAt: new Date().toISOString(),
        reason: "TEST",
        refType: "test",
        refId: "x",
        lines: [
          line("USER_AVAILABLE", "u", "GOLD", 0n, 10n),
          line("PLATFORM_AVAILABLE", PLATFORM_HOLDER, "GOLD", 3n, 0n),
        ],
      })
    ).rejects.toMatchObject({ code: "unbalanced_journal" });
    await expect(
      postJournal(store, {
        id: "cross",
        createdAt: new Date().toISOString(),
        reason: "TEST",
        refType: "test",
        refId: "x",
        lines: [
          line("USER_AVAILABLE", "u", "GOLD", 10n, 0n),
          line("USER_AVAILABLE", "u", "IRR", 0n, 10n),
        ],
      })
    ).rejects.toMatchObject({ code: "unbalanced_journal" });
  });
});

describe("account policy", () => {
  it("rejects fee revenue and PSP clearing on metal", () => {
    expect(() =>
      assertAccountPolicy(PLATFORM_HOLDER, "PLATFORM_FEE_REVENUE", "GOLD", PLATFORM_HOLDER)
    ).toThrow(/cannot hold/);
    expect(() =>
      assertAccountPolicy(PLATFORM_HOLDER, "PAYMENT_GATEWAY_CLEARING", "SILVER", PLATFORM_HOLDER)
    ).toThrow(/cannot hold/);
  });
});

describe("treasury honesty", () => {
  it("marks treasury as a milestone placeholder with null customer liability", async () => {
    const { core } = makeMemoryCore();
    const tre = await core.treasury("GOLD");
    expect(tre.kind).toBe("CORE_MILESTONE_PLACEHOLDER");
    expect(tre.customerMetalLiabilityUg).toBeNull();
    expect(tre.customerLiabilityComplete).toBe(false);
  });
});

describe("quote request model", () => {
  it("stores null for the non-authoritative requested field", async () => {
    const { core, store } = makeMemoryCore();
    const user = "qmodel";
    await core.sandboxDeposit(user, tomanToIrr(10_000_000), "d");
    const q = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(1_000_000),
    });
    const stored = await store.getQuote(q.id);
    expect(stored?.requestedIrr).toBe(tomanToIrr(1_000_000));
    expect(stored?.requestedWeightUg).toBeNull();
  });
});
