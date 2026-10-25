import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlusActive } from "@/lib/commerce/fees";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier, plan_expires_at, referral_code, kyc_status")
    .eq("id", user.id)
    .maybeSingle();

  const tier = (profile?.plan_tier as "free" | "plus") ?? "free";
  const plusActive = isPlusActive(tier, profile?.plan_expires_at);

  return NextResponse.json({
    ok: true,
    planTier: plusActive ? "plus" : "free",
    planExpiresAt: profile?.plan_expires_at ?? null,
    referralCode: profile?.referral_code ?? null,
    kycStatus: profile?.kyc_status ?? "UNVERIFIED",
  });
}
