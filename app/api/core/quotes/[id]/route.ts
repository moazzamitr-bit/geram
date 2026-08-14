import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { serializeQuote } from "@/lib/core/adapters";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const userId = await requireCoreUserId();
    const core = getFinancialCore();
    const quote = await core.getQuoteForUser(userId, id);
    if (!quote) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return Response.json({ ok: true, quote: serializeQuote(quote) });
  } catch (err) {
    return jsonError(err);
  }
}
