import { jsonError, readIdempotencyKey, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { serializeTrade } from "@/lib/core/adapters";
import { assertWithinDailyLimit } from "@/lib/core/limits";
import { irrToSafeTomanNumber } from "@/lib/core/money";
import { CoreError } from "@/lib/core/types";
import { assertTradeKyc } from "@/lib/kyc/trade-gate";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    await assertTradeKyc(userId);
    const body = (await request.json()) as { quoteId?: string; idempotencyKey?: string };
    if (!body.quoteId) throw new CoreError("invalid_quote", "quoteId required");
    const key = readIdempotencyKey(request, body.idempotencyKey);
    const core = getFinancialCore();

    const quote = await core.getQuoteForUser(userId, body.quoteId);
    if (quote && quote.status === "ACTIVE") {
      const settings = await loadCommerceSettings();
      await assertWithinDailyLimit({
        core,
        userId,
        side: quote.side,
        requestedToman: irrToSafeTomanNumber(quote.grossIrr),
        limits: settings.limits,
      });
    }

    const trade = await core.executeTrade({
      userId,
      quoteId: body.quoteId,
      idempotencyKey: key,
    });
    return Response.json({ ok: true, trade: serializeTrade(trade) });
  } catch (err) {
    return jsonError(err);
  }
}
