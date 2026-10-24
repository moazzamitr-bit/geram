import { NextResponse } from "next/server";
import { authMethod } from "@/lib/auth/method";
import { otpMode, verifyOtp } from "@/lib/auth/otp";
import { createOtpSession } from "@/lib/db/phone-auth";
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
    const signedIn = await createOtpSession(phone);
    return NextResponse.json({
      ok: true,
      session: signedIn.session,
      profile: signedIn.profile,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "auth_failed";
    console.error("phone_login", message);
    if (message === "phone_auth_misconfigured") {
      return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
    }
    if (/rate limit/i.test(message)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "auth_failed" }, { status: 500 });
  }
}
