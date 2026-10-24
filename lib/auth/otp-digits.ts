import { toEnglishDigits } from "@/lib/kyc/national-id";

/** ASCII digits only, capped at the Finnotech code length. */
export function otpDigitsOnly(raw: string, length: number) {
  const max = length > 0 ? length : 0;
  return toEnglishDigits(raw).replace(/\D/g, "").slice(0, max);
}

/**
 * Type one digit into a box, or paste the whole code into any box.
 * A paste that contains the full code fills from the first box.
 */
export function applyOtpInput(boxes: readonly string[], index: number, raw: string): string[] {
  const length = boxes.length;
  const next = boxes.slice();
  if (index < 0 || index >= length) return next;
  const incoming = toEnglishDigits(raw).replace(/\D/g, "");
  if (incoming.length === 0) {
    next[index] = "";
    return next;
  }
  if (incoming.length === 1) {
    next[index] = incoming;
    return next;
  }
  const start = incoming.length >= length ? 0 : index;
  const digits = incoming.slice(0, length - start);
  for (let i = 0; i < digits.length; i++) next[start + i] = digits[i];
  return next;
}

export function otpCodeFromBoxes(boxes: readonly string[]) {
  return boxes.every((digit) => digit.length === 1) ? boxes.join("") : "";
}
