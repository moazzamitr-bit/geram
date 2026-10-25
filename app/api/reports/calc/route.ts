import { isAssetCode } from "@/lib/core/assets";
import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { CoreError } from "@/lib/core/types";
import { resolveUserFeeSnapshot } from "@/lib/core/user-fees";

export const dynamic = "force-dynamic";

/** Price calculator: what a trade would give right now. Stores nothing, reserves nothing. */
export async function GET(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const sp = new URL(request.url).searchParams;
    const asset = sp.get("asset") ?? "GOLD";
    const side = sp.get("side") === "SELL" ? "SELL" : "BUY";
    if (!isAssetCode(asset) || asset === "TEST_METAL") throw new CoreError("unknown_asset", "فلز نامعتبر است.");
    const toman = Number(sp.get("toman") ?? 0);
    const grams = Number(sp.get("grams") ?? 0);
    const byToman = toman > 0;
    if (!byToman && !(grams > 0)) throw new CoreError("invalid_amount", "مبلغ یا وزن را وارد کنید.");
    if (toman > 1e12 || grams > 1e5) throw new CoreError("invalid_amount", "مقدار خیلی بزرگ است.");
    const p = await getFinancialCore().previewQuote({
      asset,
      side,
      inputMode: byToman ? "RIAL_AMOUNT" : "METAL_WEIGHT",
      requestedIrr: byToman ? BigInt(Math.round(toman)) * 10n : undefined,
      requestedWeightUg: byToman ? undefined : BigInt(Math.round(grams * 1_000_000)),
      fees: await resolveUserFeeSnapshot(userId),
    });
    return Response.json({
      ok: true,
      asset,
      side,
      priceIrrPerGram: p.executionPriceIrrPerGram.toString(),
      grossIrr: p.grossIrr.toString(),
      feeIrr: p.feeIrr.toString(),
      netIrr: p.netIrr.toString(),
      weightUg: p.weightUg.toString(),
      stale: p.stale,
    });
  } catch (err) {
    return jsonError(err);
  }
}
