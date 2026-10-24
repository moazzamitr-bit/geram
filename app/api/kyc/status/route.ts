import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { KYC_LEVEL_CAPS, KYC_LEVEL_TITLES, resolveKycLevel } from "@/lib/kyc/levels";
import { kycRequiredForTrade } from "@/lib/kyc/trade-gate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("kyc_status, kyc_level, kyc_bank_verified_at, kyc_bank_mask, first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    const level = resolveKycLevel(data ?? {});
    return Response.json({
      ok: true,
      level,
      title: KYC_LEVEL_TITLES[level],
      status: data?.kyc_status ?? "UNVERIFIED",
      bankMask: data?.kyc_bank_mask ?? null,
      firstName: data?.first_name ?? "",
      lastName: data?.last_name ?? "",
      kycRequired: kycRequiredForTrade(),
      caps: KYC_LEVEL_CAPS,
    });
  } catch (err) {
    return jsonError(err);
  }
}
