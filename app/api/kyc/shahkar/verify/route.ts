import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { safeFinnotechLog } from "@/lib/finnotech/client";
import { confirmUserKyc } from "@/lib/kyc/actions";
import { KycFlowError } from "@/lib/kyc/flow";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const body = (await request.json().catch(() => ({}))) as { otp?: string };
    const result = await confirmUserKyc({
      userId,
      otp: body.otp ?? "",
      ip: clientIp(request),
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof KycFlowError) {
      return Response.json(
        { ok: false, error: err.code, message: err.message },
        { status: err.httpStatus }
      );
    }
    safeFinnotechLog("kyc_shahkar_verify", err);
    return jsonError(err);
  }
}
