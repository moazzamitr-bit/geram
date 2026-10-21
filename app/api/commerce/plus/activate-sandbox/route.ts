import { NextResponse } from "next/server";
import { getExecutionMode, getFeatureFlags } from "@/lib/core/mode";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Free 30-day Plus with no payment — SANDBOX only, written by the service role. */
export async function POST() {
  let mode: string;
  try {
    mode = getExecutionMode();
  } catch {
    mode = "UNKNOWN";
  }
  if (mode !== "SANDBOX" || !getFeatureFlags().GERAM_PLUS_ENABLED) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  const { error } = await admin
    .from("profiles")
    .update({
      plan_tier: "plus",
      plan_expires_at: expires.toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("activate_plus_sandbox", error.message);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    planTier: "plus",
    planExpiresAt: expires.toISOString(),
    message: "گرم پلاس برای ۳۰ روز فعال شد (سندباکس).",
  });
}
