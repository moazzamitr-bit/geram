import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authMethod } from "@/lib/auth/method";
import { otpMode, verifyOtp } from "@/lib/auth/otp";
import { ensurePhoneUser } from "@/lib/db/phone-auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Password mode must answer method_disabled before any Supabase call.
  if (authMethod() !== "otp") {
    return NextResponse.json({ ok: false, error: "method_disabled" }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 503 }
    );
  }
  // Real SMS OTP when a provider is configured; the fixed demo code only in
  // SANDBOX. Without either, login is refused (see lib/auth/otp.ts).
  if (otpMode() === "unavailable") {
    return NextResponse.json(
      { ok: false, error: "otp_provider_not_configured" },
      { status: 503 }
    );
  }

  const ipLimit = rateLimit(`login:ip:${clientIp(request)}`, 20, 10 * 60 * 1000);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfterSec);

  const body = (await request.json().catch(() => ({}))) as { phone?: string; otp?: string };
  const phone = (body.phone ?? "").replace(/\D/g, "").replace(/^98/, "0");
  const otp = (body.otp ?? "").replace(/\D/g, "");

  if (!/^09\d{9}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }
  const phoneLimit = rateLimit(`login:phone:${phone}`, 8, 10 * 60 * 1000);
  if (!phoneLimit.ok) return tooManyRequests(phoneLimit.retryAfterSec);

  const verified = await verifyOtp(phone, otp);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error }, { status: 401 });
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
