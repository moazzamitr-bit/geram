/**
 * Scopes this deployment asks for on the client-credentials token.
 * Finnotech omits a scope the client was not granted; it does not fail the
 * whole token. KYC uses the Shahkar and identification scopes. Login OTP
 * prefers messaging and falls back to finnotext when a sender number is set.
 */
export const FINNOTECH_SCOPES = [
  "kyc:sms-shahkar-send:get",
  "kyc:sms-shahkar-verification:get",
  "facility:sms-shahkar-send:get",
  "kyc:identification-inquiry:get",
  "messaging:otp-initiate:post",
  "messaging:otp-verify:post",
  "facility:finnotext-otp:post",
].join(",");

export function finnotechBaseUrl() {
  const raw = process.env.FINNOTECH_BASE_URL?.trim() || "https://api.finnotech.ir";
  return raw.replace(/\/+$/, "");
}

export function finnotechClientId() {
  return process.env.FINNOTECH_CLIENT_ID?.trim() || "";
}

export function finnotechSmsSender() {
  return process.env.FINNOTECH_SMS_SENDER?.trim() || "";
}

/** Client id, secret, and the operator national id Finnotech requires to mint a token. */
export function finnotechConfigured() {
  return Boolean(
    finnotechClientId() &&
      process.env.FINNOTECH_CLIENT_SECRET?.trim() &&
      process.env.FINNOTECH_NID?.trim()
  );
}

export function finnotechTimeoutMs() {
  const parsed = Number(process.env.FINNOTECH_TIMEOUT_MS ?? 12_000);
  if (!Number.isFinite(parsed) || parsed < 20 || parsed > 30_000) return 12_000;
  return parsed;
}

/** messaging (Finnotech generates the code) unless the operator picks finnotext. */
export function finnotechOtpChannel(): "messaging" | "finnotext" {
  if (process.env.FINNOTECH_OTP_CHANNEL?.trim() === "finnotext" && finnotechSmsSender()) {
    return "finnotext";
  }
  return "messaging";
}
