/**
 * How users sign up and sign in.
 *
 * "password" (default): mobile number + password, no SMS. The number is NOT
 *   verified, so this is only for the pre-launch period — require OTP and KYC
 *   before real money moves.
 * "otp": one-time SMS code (lib/auth/otp.ts).
 */
export type AuthMethod = "password" | "otp";

export function authMethod(): AuthMethod {
  return process.env.AUTH_METHOD === "otp" ? "otp" : "password";
}

export const MIN_PASSWORD_LENGTH = 8;

export function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "").replace(/^98/, "0");
}

export function isValidPhone(phone: string) {
  return /^09\d{9}$/.test(phone);
}
