import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { usedToday } from "@/lib/core/limits";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { effectiveTradeLimits } from "@/lib/kyc/levels";
import { readTradeKyc } from "@/lib/kyc/trade-gate";

export const dynamic = "force-dynamic";

/** Daily caps and today's usage for the signed-in user. */
export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const settings = await loadCommerceSettings();
    const kyc = await readTradeKyc(userId);
    const limits = effectiveTradeLimits(settings.limits, kyc.level, kyc.required);
    const used = await usedToday(getFinancialCore(), userId);
    return Response.json({
      ok: true,
      limits,
      kycLevel: kyc.level,
      kycRequired: kyc.required,
      withdrawUnlocked: !kyc.required || kyc.level >= 2,
      used: { buyToman: used.buyToman, sellToman: used.sellToman, withdrawToman: 0 },
    });
  } catch (err) {
    return jsonError(err);
  }
}
