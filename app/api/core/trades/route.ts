import { jsonError, readIdempotencyKey, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { serializeTrade } from "@/lib/core/adapters";
import { CoreError } from "@/lib/core/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const body = (await request.json()) as { quoteId?: string; idempotencyKey?: string };
    if (!body.quoteId) throw new CoreError("invalid_quote", "quoteId required");
    const key = readIdempotencyKey(request, body.idempotencyKey);
    const core = getFinancialCore();
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
