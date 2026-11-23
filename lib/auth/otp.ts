import { createHash, randomInt, timingSafeEqual } from "crypto";
import {
  finnotechConfigured,
  finnotechOtpChannel,
  finnotechOtpDigits,
  finnotechSmsSender,
} from "@/lib/finnotech/config";
import { safeFinnotechLog } from "@/lib/finnotech/client";
import { maskMobile } from "@/lib/finnotech/redact";
import {
  initiateMessagingOtp,
  messagingScopeMissing,
  sendFinnotextOtp,
  verifyMessagingOtp,
} from "@/lib/finnotech/otp";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";

/** Login code stays valid for two minutes, and resend waits the same two minutes. */
export const OTP_TTL_MS = 2 * 60 * 1000;
export const OTP_RESEND_SEC = 120;
const RESEND_COOLDOWN_MS = OTP_RESEND_SEC * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

export function otpCodeLength() {
  return finnotechOtpDigits();
}

export function newLoginCode() {
  const digits = otpCodeLength();
  return String(randomInt(0, 10 ** digits)).padStart(digits, "0");
}

/** Length Finnotech reported for this challenge, stored beside the external hash. */
export function messagingStoredLength(codeHash: string): number | null {
  const match = /^external:(\d+)$/.exec(codeHash);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < 4 || parsed > 8) return null;
  return parsed;
}

function externalCodeHash(length: number) {
  return `external:${length}`;
}

export type OtpMode = "sms" | "unavailable";

export type SmsProvider = "finnotech" | "smsir" | "kavenegar";

export function smsIrConfigured() {
  return Boolean(process.env.SMSIR_API_KEY && process.env.SMSIR_TEMPLATE_ID);
}

export function kavenegarConfigured() {
  return Boolean(process.env.KAVENEGAR_API_KEY && process.env.KAVENEGAR_OTP_TEMPLATE);
}

/** sms.ir, then Kavenegar — used when Finnotech is absent or messaging cannot run. */
export function localSmsFallback(): "smsir" | "kavenegar" | null {
  if (smsIrConfigured()) return "smsir";
  if (kavenegarConfigured()) return "kavenegar";
  return null;
}

/** Finnotech wins when configured. Otherwise sms.ir, then Kavenegar. */
export function smsProvider(): SmsProvider | null {
  if (finnotechConfigured()) return "finnotech";
  return localSmsFallback();
}

function logOtpSendFailed(reason: string, phone: string, detail?: string) {
  if (detail) console.error("otp_send_failed", reason, maskMobile(phone), detail);
  else console.error("otp_send_failed", reason, maskMobile(phone));
}

/** In-memory cap on OTP sends: 8 per hour per IP and 5 per hour per phone. */
export function consumeOtpSendRate(phone: string, ip: string, now = Date.now()) {
  const ipHit = rateLimit(`otp-send:ip:${ip || "unknown"}`, 8, 60 * 60 * 1000, now);
  if (!ipHit.ok) {
    return { ok: false as const, error: "too_many" as const, retryAfterSec: ipHit.retryAfterSec };
  }
  const phoneHit = rateLimit(`otp-send:phone:${phone}`, 5, 60 * 60 * 1000, now);
  if (!phoneHit.ok) {
    return { ok: false as const, error: "too_many" as const, retryAfterSec: phoneHit.retryAfterSec };
  }
  return { ok: true as const };
}

/**
 * "sms": a real provider is configured (sms.ir verify or Kavenegar lookup).
 * "unavailable": no provider outside SANDBOX — login must be refused.
 */
export function otpMode(): OtpMode {
  // No fixed/demo code exists in any mode: without a provider, login is refused.
  return smsProvider() && process.env.SUPABASE_SERVICE_ROLE_KEY ? "sms" : "unavailable";
}

function hashCode(phone: string, code: string) {
  // Salted with a server secret so a leaked table cannot be brute-forced offline.
  const salt = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHash("sha256").update(`${salt}:${phone}:${code}`).digest("hex");
}

/**
 * sms.ir Verify API (https://app.sms.ir/developer/help/verify).
 * Template 123456 is sms.ir's sandbox template: it only delivers to the panel
 * owner's own number. Real users need an approved template (requires eNamad).
 */
export async function sendSmsIr(phone: string, code: string) {
  const res = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": process.env.SMSIR_API_KEY!,
    },
    body: JSON.stringify({
      mobile: phone,
      templateId: Number(process.env.SMSIR_TEMPLATE_ID),
      parameters: [{ name: process.env.SMSIR_PARAM_NAME || "Code", value: code }],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => null)) as { status?: number; message?: string } | null;
  if (!res.ok || data?.status !== 1) {
    throw new Error(`smsir_${res.status}_${data?.status ?? "x"}_${data?.message ?? ""}`);
  }
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
  | { ok: true; mode: OtpMode; resendInSec: number; codeLength: number }
  | { ok: false; error: "cooldown" | "too_many" | "unavailable" | "send_failed"; retryAfterSec?: number };

export async function requestOtp(phone: string, ip = "unknown"): Promise<RequestOtpResult> {
  const mode = otpMode();
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

  const paced = consumeOtpSendRate(phone, ip, now);
  if (!paced.ok) return { ok: false, error: "too_many", retryAfterSec: paced.retryAfterSec };

  if (smsProvider() === "finnotech") {
    return sendFinnotechOtp(db, phone, sentCount, windowStart, now);
  }

  const local = localSmsFallback();
  if (!local) return { ok: false, error: "unavailable" };
  return storeAndSendLocalCode(db, phone, sentCount, windowStart, now, local);
}

type OtpDb = ReturnType<typeof createServiceClient>;

async function storeAndSendLocalCode(
  db: OtpDb,
  phone: string,
  sentCount: number,
  windowStart: string,
  now: number,
  provider: "smsir" | "kavenegar"
): Promise<RequestOtpResult> {
  const code = newLoginCode();
  const { error } = await db.from("auth_otp_codes").upsert({
    phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(now + OTP_TTL_MS).toISOString(),
    attempts: 0,
    sent_count: sentCount,
    window_started_at: windowStart,
    last_sent_at: new Date(now).toISOString(),
    provider: "local",
    provider_ref: null,
  });
  if (error) {
    console.error("otp_store", error.message);
    return { ok: false, error: "send_failed" };
  }
  try {
    if (provider === "smsir") await sendSmsIr(phone, code);
    else await sendKavenegar(phone, code);
  } catch (err) {
    console.error("otp_send", err instanceof Error ? err.message : err);
    logOtpSendFailed(provider, phone);
    return { ok: false, error: "send_failed" };
  }
  return { ok: true, mode: "sms", resendInSec: OTP_RESEND_SEC, codeLength: otpCodeLength() };
}

type FinnotextAttempt =
  | { ok: true; mode: "sms"; resendInSec: number; codeLength: number }
  | { ok: false; error: "send_failed"; scopeMissing: boolean };

async function tryFinnotextOtp(
  db: OtpDb,
  phone: string,
  sentCount: number,
  windowStart: string,
  now: number
): Promise<FinnotextAttempt> {
  const code = newLoginCode();
  const { error } = await db.from("auth_otp_codes").upsert({
    phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(now + OTP_TTL_MS).toISOString(),
    attempts: 0,
    sent_count: sentCount,
    window_started_at: windowStart,
    last_sent_at: new Date(now).toISOString(),
    provider: "finnotech_finnotext",
    provider_ref: null,
  });
  if (error) {
    console.error("otp_store", error.message);
    return { ok: false, error: "send_failed", scopeMissing: false };
  }
  try {
    await sendFinnotextOtp(phone, code);
  } catch (err) {
    safeFinnotechLog("otp_finnotext", err);
    logOtpSendFailed("finnotext_failed", phone);
    return { ok: false, error: "send_failed", scopeMissing: messagingScopeMissing(err) };
  }
  return { ok: true, mode: "sms", resendInSec: OTP_RESEND_SEC, codeLength: otpCodeLength() };
}

/**
 * After messaging cannot run (missing scope / token_rejected), try finnotext
 * if a sender line is set, then sms.ir, then Kavenegar. Do not fall through
 * after a non-scope finnotext error — that request may already have been sent.
 */
async function fallbackAfterMessagingScopeMiss(
  db: OtpDb,
  phone: string,
  sentCount: number,
  windowStart: string,
  now: number
): Promise<RequestOtpResult> {
  if (finnotechSmsSender()) {
    const sent = await tryFinnotextOtp(db, phone, sentCount, windowStart, now);
    if (sent.ok) return sent;
    if (!sent.scopeMissing) return { ok: false, error: "send_failed" };
  }
  const local = localSmsFallback();
  if (local) return storeAndSendLocalCode(db, phone, sentCount, windowStart, now, local);
  logOtpSendFailed("messaging_scope_missing", phone, "no_fallback_provider");
  return { ok: false, error: "send_failed" };
}

async function sendFinnotechOtp(
  db: OtpDb,
  phone: string,
  sentCount: number,
  windowStart: string,
  now: number
): Promise<RequestOtpResult> {
  const channel = finnotechOtpChannel();
  if (channel === "messaging") {
    try {
      const initiated = await initiateMessagingOtp(phone);
      const { error } = await db.from("auth_otp_codes").upsert({
        phone,
        code_hash: externalCodeHash(initiated.codeLength),
        expires_at: new Date(now + initiated.expiresIn * 1000).toISOString(),
        attempts: 0,
        sent_count: sentCount,
        window_started_at: windowStart,
        last_sent_at: new Date(now).toISOString(),
        provider: "finnotech_messaging",
        provider_ref: initiated.traceId,
      });
      if (error) {
        console.error("otp_store", error.message);
        return { ok: false, error: "send_failed" };
      }
      return { ok: true, mode: "sms", resendInSec: OTP_RESEND_SEC, codeLength: initiated.codeLength };
    } catch (err) {
      safeFinnotechLog("otp_finnotech", err);
      if (messagingScopeMissing(err)) {
        return fallbackAfterMessagingScopeMiss(db, phone, sentCount, windowStart, now);
      }
      logOtpSendFailed("messaging_failed", phone);
      return { ok: false, error: "send_failed" };
    }
  }

  const sent = await tryFinnotextOtp(db, phone, sentCount, windowStart, now);
  if (sent.ok) return sent;
  if (sent.scopeMissing) {
    const local = localSmsFallback();
    if (local) return storeAndSendLocalCode(db, phone, sentCount, windowStart, now, local);
  }
  return { ok: false, error: "send_failed" };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: "invalid_otp" | "expired" | "too_many_attempts" | "unavailable" };

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const mode = otpMode();
  if (mode === "unavailable") return { ok: false, error: "unavailable" };

  const db = createServiceClient();
  const { data: row } = await db
    .from("auth_otp_codes")
    .select("code_hash, expires_at, attempts, provider, provider_ref")
    .eq("phone", phone)
    .maybeSingle();
  if (!row) return { ok: false, error: "invalid_otp" };
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }
  if (Number(row.attempts) >= MAX_ATTEMPTS) {
    return { ok: false, error: "too_many_attempts" };
  }

  if (row.provider === "finnotech_messaging") {
    const traceId = String(row.provider_ref ?? "");
    if (!traceId) return { ok: false, error: "invalid_otp" };
    // Exact length Finnotech used for this send (initiate result, else default 5).
    // Do not require 6 digits: that check rejected the 5-digit SMS.
    const expected = messagingStoredLength(String(row.code_hash)) ?? otpCodeLength();
    if (code.length !== expected) return { ok: false, error: "invalid_otp" };
    let matched = false;
    try {
      matched = await verifyMessagingOtp(traceId, code);
    } catch (err) {
      safeFinnotechLog("otp_verify", err);
      return { ok: false, error: "unavailable" };
    }
    if (!matched) {
      await db
        .from("auth_otp_codes")
        .update({ attempts: Number(row.attempts) + 1 })
        .eq("phone", phone);
      return { ok: false, error: "invalid_otp" };
    }
    await db
      .from("auth_otp_codes")
      .update({
        expires_at: new Date(0).toISOString(),
        attempts: MAX_ATTEMPTS,
        provider_ref: null,
      })
      .eq("phone", phone);
    return { ok: true };
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
