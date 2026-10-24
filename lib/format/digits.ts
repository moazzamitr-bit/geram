const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC = "٠١٢٣٤٥٦٧٨٩";

/** Persian and Arabic-Indic digits become ASCII. Length is unchanged. */
export function toAsciiDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC.indexOf(digit)));
}

export function toPersianDigits(input: string): string {
  return input.replace(/\d/g, (digit) => PERSIAN[Number(digit)] ?? digit);
}
