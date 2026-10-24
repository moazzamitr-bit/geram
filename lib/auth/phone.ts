import { toEnglishDigits } from "@/lib/kyc/national-id";

/** Iranian mobile helpers shared by OTP and password login. */

export function normalizeIranMobile(input: string) {
  let digits = toEnglishDigits(input).replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = digits.slice(4);
  if (digits.startsWith("98") && digits.length >= 12) digits = `0${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 10) digits = `0${digits}`;
  return digits;
}

export function isIranMobile(digits: string) {
  return /^09\d{9}$/.test(digits);
}

/** Synthetic email — must use a real domain Supabase accepts (not .local / example.com). */
export function phoneEmail(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `p${digits}@geram.vercel.app`;
}

export function phoneE164(digits: string) {
  const normalized = normalizeIranMobile(digits);
  if (!isIranMobile(normalized)) throw new Error("invalid_phone");
  return `+98${normalized.slice(1)}`;
}
