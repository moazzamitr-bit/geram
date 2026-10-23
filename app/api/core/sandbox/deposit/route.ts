import { jsonError, readIdempotencyKey, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { getExecutionMode, getFeatureFlags, sandboxDepositAllowed } from "@/lib/core/mode";
import { tomanToIrr } from "@/lib/core/money";
import { CoreError } from "@/lib/core/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const mode = getExecutionMode();
    const flags = getFeatureFlags(mode);
    if (!sandboxDepositAllowed(mode, flags)) {
      throw new CoreError(
        "sandbox_deposit_blocked",
        "User self-serve deposit is disabled. Wallet credit is admin-only.",
        403
      );
    }
    const body = (await request.json()) as { toman?: number; irr?: string; idempotencyKey?: string };
    const amountIrr = body.irr != null ? BigInt(body.irr) : tomanToIrr(body.toman ?? 0);
    const core = getFinancialCore();
    const result = await core.sandboxDeposit(
      userId,
      amountIrr,
      readIdempotencyKey(request, body.idempotencyKey)
    );
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err);
  }
}
