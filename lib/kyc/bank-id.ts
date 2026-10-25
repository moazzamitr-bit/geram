import { createHash } from "crypto";
import { toEnglishDigits } from "@/lib/kyc/national-id";
import { isLuhnValid } from "@/lib/kyc/card";

/** Salted one-way hash so the database and logs never keep the card number. */
export function hashCard(card: string) {
  const salt = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "geram";
  return createHash("sha256").update(`${salt}:card:${card}`).digest("hex");
}

/** 16-digit card that passes Luhn. Returns null when the shape is wrong. */
export function normalizeIranCard(input: string): string | null {
  const digits = toEnglishDigits(input).replace(/\D/g, "");
  return isLuhnValid(digits) ? digits : null;
}
