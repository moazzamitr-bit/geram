/**
 * Per-call scopes. Finnotech rejects the whole token request (400 "client has
 * no access to this scope") if any requested scope is not granted to the
 * client, so each call mints a token for only the scopes it needs. Every
 * scope below is granted to the geram client.
 */
export const FINNOTECH_SCOPE = {
  shahkarSend: ["kyc:sms-shahkar-send:get"],
  shahkarVerify: ["kyc:sms-shahkar-verification:get"],
  identification: ["kyc:identification-inquiry:get"],
  cardOwner: ["kyc:card-owner-verification:post"],
  ibanOwner: ["kyc:iban-owner-verification:get"],
  /** Login OTP: messaging initiate/verify, or finnotext delivery when a sender line is set. */
  loginOtp: ["messaging:otp-initiate:post", "messaging:otp-verify:post", "facility:finnotext-otp:post"],
} as const satisfies Record<string, readonly string[]>;

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
