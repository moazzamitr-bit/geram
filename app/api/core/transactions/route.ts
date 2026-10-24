import { journalToUi, serializeJournal, serializeTrade, tradeToDemoTx } from "@/lib/core/adapters";
import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const core = getFinancialCore();
    const { trades, journals } = await core.listActivity(userId);
    const postedTradeIds = new Set(
      journals.filter((journal) => journal.refType === "trade").map((journal) => journal.refId)
    );
    const ui = [
      ...journals.map((journal) => ({
        sortAt: journal.createdAt,
        row: journalToUi(journal, userId),
      })),
      ...trades
        .filter((trade) => !postedTradeIds.has(trade.id))
        .map((trade) => ({ sortAt: trade.createdAt, row: tradeToDemoTx(trade) })),
    ]
      .sort((a, b) => (a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0))
      .map((item) => item.row);

    return Response.json({
      ok: true,
      trades: trades.map(serializeTrade),
      journals: journals.map(serializeJournal),
      ui,
    });
  } catch (err) {
    return jsonError(err);
  }
}
