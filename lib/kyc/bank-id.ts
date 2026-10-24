import { createHash } from "crypto";
import { toEnglishDigits } from "@/lib/kyc/national-id";

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** 16-digit card that passes Luhn. Returns null when the shape is wrong. */
export function normalizeIranCard(input: string): string | null {
  const digits = toEnglishDigits(input).replace(/\D/g, "");
  if (!/^\d{16}$/.test(digits) || !luhn(digits)) return null;
  return digits;
}

function ibanMod97(iban: string) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let expanded = "";
  for (const ch of rearranged) {
    expanded += ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
  }
  let rem = 0;
  for (const ch of expanded) rem = (rem * 10 + Number(ch)) % 97;
  return rem;
}

/** Iranian IBAN: IR + 24 digits, ISO 13616 checksum. */
export function normalizeIranIban(input: string): string | null {
  const compact = toEnglishDigits(input).replace(/[\s-]/g, "").toUpperCase();
  const iban = compact.startsWith("IR") ? compact : `IR${compact}`;
  if (!/^IR\d{24}$/.test(iban) || ibanMod97(iban) !== 1) return null;
  return iban;
}

export function maskPayment(input: { card?: string | null; iban?: string | null }) {
  if (input.card && input.card.length >= 4) return `کارت •••• ${input.card.slice(-4)}`;
  if (input.iban && input.iban.length >= 4) return `شبا •••• ${input.iban.slice(-4)}`;
  return "حساب بانکی";
}

/** One-way fingerprint so logs never keep the card number. */
export function fingerprintCard(card: string) {
  const salt = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "geram";
  return createHash("sha256").update(`${salt}:card:${card}`).digest("hex");
}
