import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  const { error } = await supabase
    .from("profiles")
    .update({
      plan_tier: "plus",
      plan_expires_at: expires.toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    planTier: "plus",
    planExpiresAt: expires.toISOString(),
    message: "گرم پلاس برای ۳۰ روز فعال شد (سندباکس).",
  });
}
