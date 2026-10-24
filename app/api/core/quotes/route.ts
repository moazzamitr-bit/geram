import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { serializeQuote } from "@/lib/core/adapters";
import { isAssetCode, uiInstrumentToAsset } from "@/lib/core/assets";
import { gramsToUg, irrToSafeTomanNumber, tomanToIrr } from "@/lib/core/money";
import { assertWithinDailyLimit } from "@/lib/core/limits";
import { effectiveTradeLimits } from "@/lib/kyc/levels";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { resolveUserFeeSnapshot } from "@/lib/core/user-fees";
import { CoreError, type InputMode, type QuoteSide } from "@/lib/core/types";
import { assertTradeKyc } from "@/lib/kyc/trade-gate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const kyc = await assertTradeKyc(userId);
    // Each BUY quote reserves platform metal for its TTL; cap quote spam.
    const limited = rateLimit(`quote:${userId}`, 30, 60 * 1000);
    if (!limited.ok) return tooManyRequests(limited.retryAfterSec);
    const body = (await request.json()) as {
      asset?: string;
      instrument?: string;
      side?: QuoteSide;
      inputMode?: InputMode;
      requestedToman?: number;
      requestedGrams?: number;
      requestedIrr?: string;
      requestedWeightUg?: string;
    };
    const rawAsset = body.asset ?? body.instrument ?? "GOLD";
    const asset = isAssetCode(rawAsset) ? rawAsset : uiInstrumentToAsset(rawAsset);
    const side = body.side;
    const inputMode = body.inputMode;
    if (side !== "BUY" && side !== "SELL") {
      throw new CoreError("invalid_side", "side must be BUY or SELL");
    }
    if (inputMode !== "RIAL_AMOUNT" && inputMode !== "METAL_WEIGHT") {
      throw new CoreError("invalid_input_mode", "inputMode invalid");
    }
    const requestedIrr =
      body.requestedIrr != null
        ? BigInt(body.requestedIrr)
        : body.requestedToman != null
          ? tomanToIrr(body.requestedToman)
          : undefined;
    const requestedWeightUg =
      body.requestedWeightUg != null
        ? BigInt(body.requestedWeightUg)
        : body.requestedGrams != null
          ? gramsToUg(body.requestedGrams)
          : undefined;
    const core = getFinancialCore();
    if (side === "BUY" && requestedIrr != null) {
      // Early check so users hear about the cap before a quote reserves metal;
      // the trade route re-checks with the exact quote amount.
      const settings = await loadCommerceSettings();
      await assertWithinDailyLimit({
        core,
        userId,
        side,
        requestedToman: irrToSafeTomanNumber(requestedIrr),
        limits: effectiveTradeLimits(settings.limits, kyc.level, kyc.required),
      });
    }
    const quote = await core.issueQuote({
      userId,
      asset,
      side,
      inputMode,
      requestedIrr,
      requestedWeightUg,
      fees: await resolveUserFeeSnapshot(userId),
    });
    return Response.json({ ok: true, quote: serializeQuote(quote) });
  } catch (err) {
    return jsonError(err);
  }
}
