import type { CommerceSettings } from "@/lib/commerce/types";
import { tomanToIrr } from "@/lib/core/money";

/**
 * Scheduled buys settle through the same quote → trade ledger path as the app.
 * They must not update `wallets`.
 */
export async function buyGoldFromLedger(input: {
  userId: string;
  amountToman: number;
  idempotencyKey: string;
  plus: boolean;
  settings: CommerceSettings;
}): Promise<{ ok: true; tradeId: string } | { ok: false; error: string }> {
  try {
    const { getFinancialCore } = await import("@/lib/core/runtime");
    const { feesFromCommercePercent } = await import("@/lib/core/engine");
    const core = getFinancialCore();
    const quote = await core.issueQuote({
      userId: input.userId,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(input.amountToman),
      fees: feesFromCommercePercent({ plus: input.plus, ...input.settings.fees }),
    });
    const trade = await core.executeTrade({
      userId: input.userId,
      quoteId: quote.id,
      idempotencyKey: input.idempotencyKey,
    });
    return { ok: true, tradeId: trade.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "ledger_buy_failed" };
  }
}
