import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { KYC_LEVEL_TITLES } from "@/lib/kyc/levels";
import { readVerification } from "@/lib/kyc/verification";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const [state, profile] = await Promise.all([
      readVerification(userId),
      supabase.from("profiles").select("kyc_status, first_name, last_name").eq("id", userId).maybeSingle(),
    ]);
    return Response.json({
      ok: true,
      ...state,
      title: KYC_LEVEL_TITLES[state.level],
      status: profile.data?.kyc_status ?? "UNVERIFIED",
      firstName: profile.data?.first_name ?? "",
      lastName: profile.data?.last_name ?? "",
    });
  } catch (err) {
    return jsonError(err);
  }
}
