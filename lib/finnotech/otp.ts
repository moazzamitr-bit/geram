import { finnotechCall, FinnotechError } from "@/lib/finnotech/client";
import { finnotechClientId, finnotechOtpDigits, finnotechSmsSender } from "@/lib/finnotech/config";

function clientPath(prefix: string) {
  return `/${prefix}/v2/clients/${encodeURIComponent(finnotechClientId())}`;
}

export type MessagingOtp = {
  traceId: string;
  expiresIn: number;
  trackId: string;
  /** Digits Finnotech will send. From the initiate result when present, else env/default 5. */
  codeLength: number;
};

type MessagingInitiateResult = {
  traceId?: string;
  expiresIn?: number;
  status?: string;
  otpLength?: number;
  codeLength?: number;
  length?: number;
  digits?: number;
};

const LENGTH_FIELDS = ["otpLength", "codeLength", "length", "digits"] as const;

/**
 * Official initiate schema (docs.finnotech.ir messagingOtpInitiatePost) returns
 * traceId, status, and expiresIn only. The published verify sample is 6 digits,
 * but the SMS Finnotech actually sends is 5. If a length field is present, use
 * it; otherwise FINNOTECH_OTP_LENGTH, default 5.
 */
export function codeLengthFromMessagingResult(result: MessagingInitiateResult | null | undefined) {
  if (result) {
    for (const key of LENGTH_FIELDS) {
      const parsed = Number(result[key]);
      if (Number.isInteger(parsed) && parsed >= 4 && parsed <= 8) return parsed;
    }
  }
  return finnotechOtpDigits();
}

/** messaging:otp-initiate:post — Finnotech generates the code. We keep only traceId. */
export async function initiateMessagingOtp(phone: string): Promise<MessagingOtp> {
  const sent = await finnotechCall<MessagingInitiateResult>({
    method: "POST",
    path: `${clientPath("messaging")}/otp/initiate`,
    body: { identifier: phone, method: "sms", purpose: "login", ttl: 120 },
    idempotent: false,
  });
  const traceId = sent.result.traceId?.trim() ?? "";
  if (!traceId) throw new FinnotechError("otp_no_trace", 200);
  const expiresIn = Number(sent.result.expiresIn ?? 120);
  return {
    traceId,
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 120,
    trackId: sent.trackId,
    codeLength: codeLengthFromMessagingResult(sent.result),
  };
}

/** messaging:otp-verify:post */
export async function verifyMessagingOtp(traceId: string, otp: string) {
  const checked = await finnotechCall<{ status?: string }>({
    method: "POST",
    path: `${clientPath("messaging")}/otp/verify`,
    body: { traceId, otp },
    idempotent: false,
  });
  return checked.result.status === "verified";
}

/**
 * facility:finnotext-otp:post — we generate the code and Finnotech only delivers it.
 * Sender number is FINNOTECH_SMS_SENDER (the line assigned to the client).
 */
export async function sendFinnotextOtp(phone: string, code: string) {
  const from = finnotechSmsSender();
  if (!from) throw new FinnotechError("sender_missing", 0);
  await finnotechCall({
    method: "POST",
    path: `${clientPath("facility")}/finnotextOtp`,
    body: {
      from,
      to: phone,
      message: `کد ورود گرم: ${code}`,
    },
    idempotent: false,
  });
}

export function messagingScopeMissing(err: unknown) {
  if (!(err instanceof FinnotechError)) return false;
  if (err.httpStatus === 403 || err.httpStatus === 404) return true;
  return /scope|forbidden|not_found|unauthorized_scope/i.test(err.code);
}
