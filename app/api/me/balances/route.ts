import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { readHolderBalancePayload } from "@/lib/ledger/read";

export const dynamic = "force-dynamic";

/**
 * Balances for the signed-in user only. The holder id comes from the session,
 * never from the query string. The read uses the service role because ledger
 * tables are not client-readable. There is no `wallets` fallback.
 */
export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const payload = await readHolderBalancePayload(userId);
    if (!payload.ok) {
      return Response.json(
        {
          ok: false,
          error: "ledger_unavailable",
          message: "موجودی دفترکل در دسترس نیست.",
        },
        { status: 503 }
      );
    }
    return Response.json({
      ok: true,
      source: "ledger",
      userId,
      ...payload.body,
    });
  } catch (err) {
    return jsonError(err);
  }
}
