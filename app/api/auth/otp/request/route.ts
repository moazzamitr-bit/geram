import { NextResponse } from "next/server";
import { authMethod } from "@/lib/auth/method";
import { requestOtp } from "@/lib/auth/otp";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (authMethod() !== "otp") {
    return NextResponse.json({ ok: false, error: "method_disabled" }, { status: 403 });
  }
  const ip = rateLimit(`otp-req:ip:${clientIp(request)}`, 10, 10 * 60 * 1000);
  if (!ip.ok) return tooManyRequests(ip.retryAfterSec);

  const body = (await request.json().catch(() => ({}))) as { phone?: string };
  const phone = (body.phone ?? "").replace(/\D/g, "").replace(/^98/, "0");
  if (!/^09\d{9}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }

  const result = await requestOtp(phone, clientIp(request));
  if (!result.ok) {
    const status =
      result.error === "cooldown" || result.error === "too_many"
        ? 429
        : result.error === "unavailable"
          ? 503
          : 502;
    return NextResponse.json(
      { ok: false, error: result.error, retryAfterSec: result.retryAfterSec ?? 0 },
      { status }
    );
  }
  return NextResponse.json({ ok: true, sandbox: result.mode === "sandbox", resendInSec: result.resendInSec });
}
