import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { serializeWallet } from "@/lib/core/adapters";
import { getExecutionMode, getFeatureFlags, getKillSwitches } from "@/lib/core/mode";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const core = getFinancialCore();
    const wallet = await core.wallet(userId);
    return Response.json({
      ok: true,
      executionMode: getExecutionMode(),
      flags: getFeatureFlags(),
      killSwitches: getKillSwitches(),
      wallet: serializeWallet(wallet),
    });
  } catch (err) {
    return jsonError(err);
  }
}
