import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { serializeWallet } from "@/lib/core/adapters";
import type { AssetCode } from "@/lib/core/assets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const core = getFinancialCore();
    const wallet = await core.wallet(userId);
    const [gold, silver, copper] = await Promise.all([
      core.costBasisTomanPerGram(userId, "GOLD"),
      core.costBasisTomanPerGram(userId, "SILVER"),
      core.costBasisTomanPerGram(userId, "COPPER"),
    ]);
    void (["GOLD", "SILVER", "COPPER"] as AssetCode[]);
    return Response.json({
      ok: true,
      wallet: serializeWallet(wallet),
      avgBuyTomanPerGram: {
        gold18: gold,
        silver925: silver,
        copper,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
