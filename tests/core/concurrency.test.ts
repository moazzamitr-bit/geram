import { describe, expect, it } from "vitest";
import { tomanToIrr } from "@/lib/core/money";
import { makeMemoryCore } from "./helpers";

function makeCore() {
  return makeMemoryCore().core;
}

describe("concurrent trades", () => {
  it("serializes two buys so rial is not double-spent", async () => {
    const core = makeCore();
    const user = "conc-user";
    await core.sandboxDeposit(user, tomanToIrr(1_000_000), "d");
    const q1 = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(1_000_000),
    });
    const q2 = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(1_000_000),
    });
    const results = await Promise.allSettled([
      core.executeTrade({ userId: user, quoteId: q1.id, idempotencyKey: "a" }),
      core.executeTrade({ userId: user, quoteId: q2.id, idempotencyKey: "b" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected");
    expect(ok.length).toBe(1);
    expect(fail.length).toBe(1);
    const w = await core.wallet(user);
    expect(w.rialAvailable).toBe(0n);
  });
});
