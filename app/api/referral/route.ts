import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { readVerification } from "@/lib/kyc/verification";
import { referralOverview } from "@/lib/referral/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const [overview, settings, verification] = await Promise.all([
      referralOverview(userId),
      loadCommerceSettings(),
      readVerification(userId),
    ]);
    return Response.json({
      ok: true,
      ...overview,
      sharePercent: settings.referral.feeSharePercent,
      verified: verification.nextStep === null,
      nextStep: verification.nextStep,
    });
  } catch (err) {
    return jsonError(err);
  }
}
