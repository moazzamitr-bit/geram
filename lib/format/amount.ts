import { toAsciiDigits, toPersianDigits } from "@/lib/format/digits";

/** Arabic thousands separator, used with both Persian and ASCII digits. */
export const AMOUNT_GROUP_SEPARATOR = "٬";
const DECIMAL_FA = "٫";

export type AmountDigits = "fa" | "en";

export type ParsedAmount = {
  /** ASCII digits and at most one trailing or in-between `.`. Empty when blank. */
  canonical: string;
  value: number;
};

function isDecimalMark(char: string) {
  return char === "." || char === DECIMAL_FA || char === "\u066b";
}

/**
 * Live amount parser. Accepts Persian/Arabic digits and pasted commas,
 * spaces, or `٬`. `decimals: 0` drops any fractional part.
 * A trailing decimal mark is kept in `canonical` so the caret can stay
 * while the next fraction digit is typed.
 */
export function parseGroupedAmount(raw: string, decimals = 0): ParsedAmount {
  const ascii = toAsciiDigits(raw);
  let intDigits = "";
  let fracDigits = "";
  let seenDot = false;
  let trailingDot = false;

  for (const char of ascii) {
    if (char >= "0" && char <= "9") {
      if (!seenDot) intDigits += char;
      else if (decimals > 0 && fracDigits.length < decimals) fracDigits += char;
      trailingDot = false;
      continue;
    }
    if (isDecimalMark(char)) {
      if (decimals <= 0) break;
      if (!seenDot) {
        seenDot = true;
        trailingDot = true;
      }
    }
  }

  intDigits = intDigits.replace(/^0+(?=\d)/, "");
  if (!intDigits && (fracDigits || trailingDot)) intDigits = "0";
  if (!intDigits) return { canonical: "", value: 0 };

  let canonical = intDigits;
  if (decimals > 0 && (fracDigits || trailingDot)) canonical += `.${fracDigits}`;
  const numeric = canonical.endsWith(".") ? canonical.slice(0, -1) : canonical;
  const value = Number(numeric);
  return { canonical, value: Number.isFinite(value) ? value : 0 };
}

export function formatCanonical(canonical: string, digits: AmountDigits = "fa"): string {
  if (!canonical) return "";
  const dot = canonical.indexOf(".");
  const intPart = dot === -1 ? canonical : canonical.slice(0, dot);
  const frac = dot === -1 ? undefined : canonical.slice(dot + 1);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, AMOUNT_GROUP_SEPARATOR);
  const decimalMark = digits === "fa" ? DECIMAL_FA : ".";
  const body = frac === undefined ? grouped : `${grouped}${decimalMark}${frac}`;
  return digits === "fa" ? toPersianDigits(body) : body;
}

/** Display for a committed number. Zero and negatives render blank. */
export function formatAmountValue(
  value: number,
  options: { decimals?: number; digits?: AmountDigits } = {}
): string {
  const decimals = options.decimals ?? 0;
  const digits = options.digits ?? "fa";
  if (!Number.isFinite(value) || value <= 0) return "";
  const canonical =
    decimals <= 0
      ? String(Math.round(value))
      : value.toFixed(decimals).replace(/\.?0+$/, "");
  return formatCanonical(canonical === "0" ? "" : canonical, digits);
}

function caretForKept(text: string, kept: number): number {
  if (kept <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? "";
    if (/[0-9۰-۹٠-٩]/.test(char) || char === "." || char === DECIMAL_FA) {
      seen += 1;
      if (seen === kept) return i + 1;
    }
  }
  return text.length;
}

/**
 * Format `raw` (the input's current value) and place the caret so the same
 * number of kept digits/decimal marks sit before it.
 */
export function editAmount(
  raw: string,
  selectionStart: number,
  options: { decimals?: number; digits?: AmountDigits } = {}
): ParsedAmount & { text: string; caret: number } {
  const decimals = options.decimals ?? 0;
  const digits = options.digits ?? "fa";
  const parsed = parseGroupedAmount(raw, decimals);
  const text = formatCanonical(parsed.canonical, digits);
  const prefix = parseGroupedAmount(raw.slice(0, Math.max(0, selectionStart)), decimals);
  return { ...parsed, text, caret: caretForKept(text, prefix.canonical.length) };
}

/** Digits the API should receive. Blank when there is no positive amount. */
export function amountCanonical(value: number, decimals = 0): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (decimals <= 0) {
    const rounded = Math.round(value);
    return Number.isSafeInteger(rounded) && rounded > 0 ? String(rounded) : "";
  }
  const fixed = value.toFixed(decimals).replace(/\.?0+$/, "");
  if (!fixed || fixed === "0") return "";
  return fixed;
}

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

function threeDigits(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds] ?? "");
  if (rest >= 10 && rest <= 19) parts.push(TEENS[rest - 10] ?? "");
  else {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    if (tens) parts.push(TENS[tens] ?? "");
    if (ones) parts.push(ONES[ones] ?? "");
  }
  return parts.filter(Boolean).join(" و ");
}

/** «پنجاه میلیون تومان» for integers of at least one thousand. */
export function tomanInWords(value: number): string {
  if (!Number.isFinite(value) || value < 1000) return "";
  const amount = Math.floor(value);
  if (!Number.isSafeInteger(amount)) return "";
  const groups: number[] = [];
  let rest = amount;
  while (rest > 0 && groups.length < SCALES.length) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  if (rest > 0) return "";
  const parts: string[] = [];
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index] ?? 0;
    if (!group) continue;
    const words = threeDigits(group);
    const scale = SCALES[index] ?? "";
    parts.push(scale ? `${words} ${scale}` : words);
  }
  return parts.length ? `${parts.join(" و ")} تومان` : "";
}
