import { createHash, randomInt, timingSafeEqual } from "crypto";
import { getExecutionMode } from "@/lib/core/mode";
import { createServiceClient } from "@/lib/supabase/admin";

const CODE_TTL_MS = 2 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

export type OtpMode = "sms" | "sandbox" | "unavailable";

/**
 * "sms": a real provider is configured (Kavenegar verify/lookup template).
 * "sandbox": no provider, SANDBOX mode — the fixed demo code is accepted.
 * "unavailable": no provider outside SANDBOX — login must be refused.
 */
export function otpMode(): OtpMode {
  if (process.env.KAVENEGAR_API_KEY && process.env.KAVENEGAR_OTP_TEMPLATE) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ? "sms" : "unavailable";
  }
  try {
    return getExecutionMode() === "SANDBOX" ? "sandbox" : "unavailable";
  } catch {
    return "unavailable";
  }
}

function hashCode(phone: string, code: string) {
  // Salted with a server secret so a leaked table cannot be brute-forced offline.
  const salt = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHash("sha256").update(`${salt}:${phone}:${code}`).digest("hex");
}

async function sendKavenegar(phone: string, code: string) {
  const key = process.env.KAVENEGAR_API_KEY!;
  const template = process.env.KAVENEGAR_OTP_TEMPLATE!;
  const url = new URL(`https://api.kavenegar.com/v1/${key}/verify/lookup.json`);
  url.searchParams.set("receptor", phone);
  url.searchParams.set("token", code);
  url.searchParams.set("template", template);
  const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`sms_provider_${res.status}`);
  }
}

export type RequestOtpResult =
  | { ok: true; mode: OtpMode; resendInSec: number }
  | { ok: false; error: "cooldown" | "too_many" | "unavailable" | "send_failed"; retryAfterSec?: number };

export async function requestOtp(phone: string): Promise<RequestOtpResult> {
  const mode = otpMode();
  if (mode === "sandbox") return { ok: true, mode, resendInSec: 60 };
  if (mode === "unavailable") return { ok: false, error: "unavailable" };

  const db = createServiceClient();
  const now = Date.now();
  const { data: row } = await db
    .from("auth_otp_codes")
    .select("last_sent_at, sent_count, window_started_at")
    .eq("phone", phone)
    .maybeSingle();

  let sentCount = 1;
  let windowStart = new Date(now).toISOString();
  if (row) {
    const sinceLast = now - new Date(row.last_sent_at as string).getTime();
    if (sinceLast < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        error: "cooldown",
        retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000),
      };
    }
    const windowAge = now - new Date(row.window_started_at as string).getTime();
    if (windowAge < 60 * 60 * 1000) {
      if (Number(row.sent_count) >= MAX_SENDS_PER_HOUR) {
        return { ok: false, error: "too_many", retryAfterSec: Math.ceil((3_600_000 - windowAge) / 1000) };
      }
      sentCount = Number(row.sent_count) + 1;
      windowStart = row.window_started_at as string;
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await db.from("auth_otp_codes").upsert({
    phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(now + CODE_TTL_MS).toISOString(),
    attempts: 0,
    sent_count: sentCount,
    window_started_at: windowStart,
    last_sent_at: new Date(now).toISOString(),
  });
  if (error) {
    console.error("otp_store", error.message);
    return { ok: false, error: "send_failed" };
  }

  try {
    await sendKavenegar(phone, code);
  } catch (err) {
    console.error("otp_send", err instanceof Error ? err.message : err);
    return { ok: false, error: "send_failed" };
  }
  return { ok: true, mode, resendInSec: RESEND_COOLDOWN_MS / 1000 };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: "invalid_otp" | "expired" | "too_many_attempts" | "unavailable" };

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const mode = otpMode();
  if (mode === "sandbox") {
    const demo = process.env.DEMO_OTP || process.env.NEXT_PUBLIC_DEMO_OTP || "123456";
    return code === demo ? { ok: true } : { ok: false, error: "invalid_otp" };
  }
  if (mode === "unavailable") return { ok: false, error: "unavailable" };

  const db = createServiceClient();
  const { data: row } = await db
    .from("auth_otp_codes")
    .select("code_hash, expires_at, attempts")
    .eq("phone", phone)
    .maybeSingle();
  if (!row) return { ok: false, error: "invalid_otp" };
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }
  if (Number(row.attempts) >= MAX_ATTEMPTS) {
    return { ok: false, error: "too_many_attempts" };
  }

  const expected = Buffer.from(String(row.code_hash), "hex");
  const actual = Buffer.from(hashCode(phone, code), "hex");
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!match) {
    await db
      .from("auth_otp_codes")
      .update({ attempts: Number(row.attempts) + 1 })
      .eq("phone", phone);
    return { ok: false, error: "invalid_otp" };
  }

  // Single use: expire immediately; keep the row for send-rate accounting.
  await db
    .from("auth_otp_codes")
    .update({ expires_at: new Date(0).toISOString(), attempts: MAX_ATTEMPTS })
    .eq("phone", phone);
  return { ok: true };
}
