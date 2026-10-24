import { maskNationalCode } from "@/lib/kyc/national-id";

/** Strip tokens, secrets, and full 10-digit national codes before anything is logged. */
export function redactSecrets(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [redacted]")
    .replace(/\b\d{10}\b/g, (digits) => maskNationalCode(digits))
    .replace(
      /(refresh[_-]?token|client[_-]?secret|access[_-]?token|authorization)(["'\s:=]+)[^\s"',}]+/gi,
      "$1$2[redacted]"
    );
}
