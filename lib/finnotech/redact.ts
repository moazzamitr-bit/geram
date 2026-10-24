import { maskNationalCode } from "@/lib/kyc/national-id";

/** Last four digits only, same idea as a national code. */
function maskMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("98") && digits.length >= 12) digits = `0${digits.slice(2)}`;
  else if (/^9\d{9}$/.test(digits)) digits = `0${digits}`;
  if (digits.length < 4) return "••••";
  return `${"•".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/** Strip tokens, secrets, national codes, and mobile numbers before anything is logged. */
export function redactSecrets(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [redacted]")
    .replace(/\+98\d{10}\b/g, (mobile) => maskMobile(mobile))
    .replace(/\b0098\d{10}\b/g, (mobile) => maskMobile(mobile))
    .replace(/\b09\d{9}\b/g, (mobile) => maskMobile(mobile))
    .replace(/\b\d{10}\b/g, (digits) => maskNationalCode(digits))
    .replace(
      /(refresh[_-]?token|client[_-]?secret|access[_-]?token|authorization)(["'\s:=]+)[^\s"',}]+/gi,
      "$1$2[redacted]"
    );
}
