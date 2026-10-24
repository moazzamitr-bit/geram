/**
 * Scopes the client-credentials token requests. Finnotech drops a scope the
 * client was not granted instead of failing the token. See docs/DEPLOY.md.
 *
 * Login OTP: messaging initiate/verify, or facility finnotext when a sender
 * line is set. The live SMS line sends 5 digits. The verify sample `554321`
 * is not the length to enforce.
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
  const parsed = Number(process.env.FINNOTECH_TIMEOUT_MS ?? 8_000);
  if (!Number.isFinite(parsed) || parsed < 20 || parsed > 30_000) return 8_000;
  return parsed;
}

/**
 * Digits in the login code. Finnotech's otp-initiate response is
 * `{ traceId, status, expiresIn }` and does not include a length. Their
 * verify example is 6 digits (`554321`), but the SMS line in production
 * sends 5. `FINNOTECH_OTP_LENGTH` overrides that (4–8).
 */
export function finnotechOtpDigits() {
  const parsed = Number(process.env.FINNOTECH_OTP_LENGTH ?? 5);
  if (!Number.isInteger(parsed) || parsed < 4 || parsed > 8) return 5;
  return parsed;
}

/** messaging (Finnotech generates the code) unless the operator picks finnotext. */
export function finnotechOtpChannel(): "messaging" | "finnotext" {
  if (process.env.FINNOTECH_OTP_CHANNEL?.trim() === "finnotext" && finnotechSmsSender()) {
    return "finnotext";
  }
  return "messaging";
}
