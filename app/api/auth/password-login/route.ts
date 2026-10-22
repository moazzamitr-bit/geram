import { NextResponse } from "next/server";
import { authMethod, isValidPhone, normalizePhone } from "@/lib/auth/method";
import { signInPhoneSession } from "@/lib/db/phone-auth";
import { isSupabaseConfigured } from "@/lib/db/types";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Mobile + password sign-in (AUTH_METHOD=password). */
export async function POST(request: Request) {
  if (authMethod() !== "password") {
    return NextResponse.json({ ok: false, error: "method_disabled" }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }
  const ip = rateLimit(`pwlogin:ip:${clientIp(request)}`, 30, 10 * 60 * 1000);
  if (!ip.ok) return tooManyRequests(ip.retryAfterSec);

  const body = (await request.json().catch(() => ({}))) as { phone?: string; password?: string };
  const phone = normalizePhone(body.phone ?? "");
  const password = body.password ?? "";
  if (!isValidPhone(phone) || !password) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 400 });
  }
  // Per-number cap slows password guessing against one account.
  const perPhone = rateLimit(`pwlogin:phone:${phone}`, 10, 10 * 60 * 1000);
  if (!perPhone.ok) return tooManyRequests(perPhone.retryAfterSec);

  const session = await signInPhoneSession(phone, password);
  if (!session) {
    // Same answer for "no such number" and "wrong password".
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...session });
}
