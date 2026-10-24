import { finnotechCall, FinnotechError } from "@/lib/finnotech/client";
import { finnotechClientId, finnotechSmsSender } from "@/lib/finnotech/config";

function clientPath(prefix: string) {
  return `/${prefix}/v2/clients/${encodeURIComponent(finnotechClientId())}`;
}

export type MessagingOtp = {
  traceId: string;
  expiresIn: number;
  trackId: string;
};

/** messaging:otp-initiate:post — Finnotech generates the code. We keep only traceId. */
export async function initiateMessagingOtp(phone: string): Promise<MessagingOtp> {
  const sent = await finnotechCall<{ traceId?: string; expiresIn?: number; status?: string }>({
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
