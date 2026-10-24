/**
 * Scopes the client-credentials token requests. Finnotech drops a scope the
 * client was not granted instead of failing the token. See docs/DEPLOY.md.
 *
 * Login OTP: messaging initiate/verify, or facility finnotext when a sender
 * line is set. The published verify sample is a 6-digit code (`554321`).
 * Identity: Shahkar SMS plus civil-registry identification.
 * Withdrawals: card and IBAN ownership against the same national id.
 */
export const FINNOTECH_SCOPES = [
  "kyc:sms-shahkar-send:get",
  "kyc:sms-shahkar-verification:get",
  "facility:sms-shahkar-send:get",
  "kyc:identification-inquiry:get",
  "kyc:card-owner-verification:post",
  "kyc:iban-owner-verification:get",
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

/**
 * Digits in the login code. Finnotech's verify sample is 6 (`554321`).
 * Set FINNOTECH_OTP_LENGTH only when the granted SMS line uses another length.
 */
export function finnotechOtpDigits() {
  const parsed = Number(process.env.FINNOTECH_OTP_LENGTH ?? 6);
  if (!Number.isInteger(parsed) || parsed < 4 || parsed > 8) return 6;
  return parsed;
}

/** messaging (Finnotech generates the code) unless the operator picks finnotext. */
export function finnotechOtpChannel(): "messaging" | "finnotext" {
  if (process.env.FINNOTECH_OTP_CHANNEL?.trim() === "finnotext" && finnotechSmsSender()) {
    return "finnotext";
  }
  return "messaging";
}
