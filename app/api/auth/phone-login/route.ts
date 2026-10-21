import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getExecutionMode } from "@/lib/core/mode";
import { ensurePhoneUser } from "@/lib/db/phone-auth";
import { isSupabaseConfigured } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 503 }
    );
  }

  // There is no SMS provider yet: the fixed demo code is a sandbox-only
  // convenience and must never authenticate users in CLOSED_BETA/PRODUCTION.
  let mode: string;
  try {
    mode = getExecutionMode();
  } catch {
    mode = "UNKNOWN";
  }
  if (mode !== "SANDBOX") {
    return NextResponse.json(
      { ok: false, error: "otp_provider_not_configured" },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { phone?: string; otp?: string };
  const phone = (body.phone ?? "").replace(/\D/g, "").replace(/^98/, "0");
  const otp = body.otp ?? "";
  const demoOtp = process.env.DEMO_OTP || process.env.NEXT_PUBLIC_DEMO_OTP || "123456";

  if (!/^09\d{9}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }
  if (otp !== demoOtp) {
    return NextResponse.json({ ok: false, error: "invalid_otp" }, { status: 401 });
  }

  try {
    const { email, password } = await ensurePhoneUser(phone);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      console.error("phone_login_sign_in", error?.message);
      return NextResponse.json({ ok: false, error: "sign_in_failed" }, { status: 500 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, phone, first_name, last_name, kyc_status, onboarding_done")
      .eq("id", data.user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      profile: profile ?? {
        id: data.user.id,
        phone,
        first_name: "",
        last_name: "",
        kyc_status: "UNVERIFIED",
        onboarding_done: false,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "auth_failed";
    console.error("phone_login", message);
    if (/rate limit/i.test(message)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
    if (/invalid_otp|invalid_phone/i.test(message)) {
      return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "auth_failed" }, { status: 500 });
  }
}
