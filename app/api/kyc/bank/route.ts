import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { safeFinnotechLog } from "@/lib/finnotech/client";
import { addUserCard, listUserCards } from "@/lib/kyc/actions";
import { KycFlowError } from "@/lib/kyc/flow";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function kycError(err: KycFlowError) {
  return Response.json({ ok: false, error: err.code, message: err.message }, { status: err.httpStatus });
}

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    return Response.json({ ok: true, cards: await listUserCards(userId) });
  } catch (err) {
    if (err instanceof KycFlowError) return kycError(err);
    return jsonError(err);
  }
}

/** Add a card. Accepted only when Finnotech matches it to the verified national code. */
export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const body = (await request.json().catch(() => ({}))) as { card?: string };
    const result = await addUserCard({ userId, card: body.card, ip: clientIp(request) });
    return Response.json(result);
  } catch (err) {
    if (err instanceof KycFlowError) return kycError(err);
    safeFinnotechLog("kyc_card", err);
    return jsonError(err);
  }
}
