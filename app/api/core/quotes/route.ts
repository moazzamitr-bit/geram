import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { getFinancialCore } from "@/lib/core/runtime";
import { serializeQuote } from "@/lib/core/adapters";
import { isAssetCode, uiInstrumentToAsset } from "@/lib/core/assets";
import { gramsToUg, tomanToIrr } from "@/lib/core/money";
import { CoreError, type InputMode, type QuoteSide } from "@/lib/core/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
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
          : 0n;
    const requestedWeightUg =
      body.requestedWeightUg != null
        ? BigInt(body.requestedWeightUg)
        : body.requestedGrams != null
          ? gramsToUg(body.requestedGrams)
          : 0n;
    const core = getFinancialCore();
    const quote = await core.issueQuote({
      userId,
      asset,
      side,
      inputMode,
      requestedIrr,
      requestedWeightUg,
    });
    return Response.json({ ok: true, quote: serializeQuote(quote) });
  } catch (err) {
    return jsonError(err);
  }
}
