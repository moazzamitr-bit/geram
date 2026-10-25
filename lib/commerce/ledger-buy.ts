import type { AssetCode } from "@/lib/core/assets";
import { tomanToIrr } from "@/lib/core/money";

/**
 * Server-side buys (savings plans, alert auto-buy) settle through the same
 * quote → trade ledger path as the app, with the user's own fee snapshot.
 */
export async function buyFromLedger(input: {
  userId: string;
  asset: AssetCode;
  amountToman: number;
  idempotencyKey: string;
}): Promise<
  | { ok: true; tradeId: string; weightUg: bigint; feeIrr: bigint; amountIrr: bigint; trackingCode: string }
  | { ok: false; error: string; code?: string }
> {
  try {
    const { getFinancialCore } = await import("@/lib/core/runtime");
    const { resolveUserFeeSnapshot } = await import("@/lib/core/user-fees");
    const core = getFinancialCore();
    const quote = await core.issueQuote({
      userId: input.userId,
      asset: input.asset,
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(input.amountToman),
      fees: await resolveUserFeeSnapshot(input.userId),
    });
    const trade = await core.executeTrade({
      userId: input.userId,
      quoteId: quote.id,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      ok: true,
      tradeId: trade.id,
      weightUg: BigInt(trade.weightUg),
      feeIrr: BigInt(trade.feeIrr),
      amountIrr: tomanToIrr(input.amountToman),
      trackingCode: trade.trackingCode,
    };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    return { ok: false, error: err instanceof Error ? err.message : "ledger_buy_failed", code };
  }
}
