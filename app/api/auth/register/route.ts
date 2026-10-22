import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authMethod,
  isValidPhone,
  MIN_PASSWORD_LENGTH,
  normalizePhone,
} from "@/lib/auth/method";
import { registerPhoneUser, signInPhoneSession } from "@/lib/db/phone-auth";
import { isSupabaseConfigured } from "@/lib/db/types";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(128),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
});

/** Mobile + password sign-up (AUTH_METHOD=password). Signs the user in on success. */
export async function POST(request: Request) {
  if (authMethod() !== "password") {
    return NextResponse.json({ ok: false, error: "method_disabled" }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }
  const ip = rateLimit(`register:ip:${clientIp(request)}`, 10, 60 * 60 * 1000);
  if (!ip.ok) return tooManyRequests(ip.retryAfterSec);

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!isValidPhone(phone)) {
    return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }

  const created = await registerPhoneUser({
    phone,
    password: parsed.data.password,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
  });
  if (!created.ok) {
    const status =
      created.error === "already_registered" ? 409 : created.error === "service_unavailable" ? 503 : 500;
    return NextResponse.json({ ok: false, error: created.error }, { status });
  }

  const session = await signInPhoneSession(phone, parsed.data.password);
  if (!session) {
    return NextResponse.json({ ok: false, error: "sign_in_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...session });
}
