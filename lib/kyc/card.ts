/**
 * Browser-safe card helpers: grouping as typed, Luhn, and the issuing bank by
 * BIN (first six digits). Server code adds hashing in bank-id.ts.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function cardDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const fa = FA_DIGITS.indexOf(ch);
    const ar = AR_DIGITS.indexOf(ch);
    if (fa >= 0) out += String(fa);
    else if (ar >= 0) out += String(ar);
    else if (ch >= "0" && ch <= "9") out += ch;
  }
  return out.slice(0, 16);
}

/** "6037991234567890" -> "6037 9912 3456 7890" (partial input too). */
export function formatCardGroups(input: string): string {
  return cardDigits(input).replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function isLuhnValid(digits: string): boolean {
  if (!/^\d{16}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let n = Number(digits[15 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** "603799******7890" style mask for display. */
export function maskCard(digits: string): string {
  return `${digits.slice(0, 4)} ${digits.slice(4, 6)}•• •••• ${digits.slice(12)}`;
}

export type IranBank = { code: string; name: string; color: string };

const BINS: Record<string, IranBank> = {
  "603799": { code: "melli", name: "بانک ملی", color: "#0F4C81" },
  "589210": { code: "sepah", name: "بانک سپه", color: "#1D4E89" },
  "627648": { code: "toseesaderat", name: "توسعه صادرات", color: "#1B7F3B" },
  "207177": { code: "toseesaderat", name: "توسعه صادرات", color: "#1B7F3B" },
  "627961": { code: "sanatmadan", name: "صنعت و معدن", color: "#004D73" },
  "603770": { code: "keshavarzi", name: "بانک کشاورزی", color: "#2E7D32" },
  "639217": { code: "keshavarzi", name: "بانک کشاورزی", color: "#2E7D32" },
  "628023": { code: "maskan", name: "بانک مسکن", color: "#E65100" },
  "627760": { code: "postbank", name: "پست بانک", color: "#00695C" },
  "502908": { code: "tosee", name: "توسعه تعاون", color: "#00838F" },
  "627412": { code: "eghtesadnovin", name: "اقتصاد نوین", color: "#6A1B9A" },
  "622106": { code: "parsian", name: "بانک پارسیان", color: "#8E1B1B" },
  "639194": { code: "parsian", name: "بانک پارسیان", color: "#8E1B1B" },
  "627884": { code: "parsian", name: "بانک پارسیان", color: "#8E1B1B" },
  "502229": { code: "pasargad", name: "بانک پاسارگاد", color: "#C9A227" },
  "639347": { code: "pasargad", name: "بانک پاسارگاد", color: "#C9A227" },
  "627488": { code: "karafarin", name: "بانک کارآفرین", color: "#00796B" },
  "502910": { code: "karafarin", name: "بانک کارآفرین", color: "#00796B" },
  "621986": { code: "saman", name: "بانک سامان", color: "#1565C0" },
  "639346": { code: "sina", name: "بانک سینا", color: "#0D47A1" },
  "639607": { code: "sarmayeh", name: "بانک سرمایه", color: "#5D4037" },
  "636214": { code: "ayandeh", name: "بانک آینده", color: "#6D4C41" },
  "502806": { code: "shahr", name: "بانک شهر", color: "#C62828" },
  "504706": { code: "shahr", name: "بانک شهر", color: "#C62828" },
  "502938": { code: "day", name: "بانک دی", color: "#00897B" },
  "603769": { code: "saderat", name: "بانک صادرات", color: "#283593" },
  "610433": { code: "mellat", name: "بانک ملت", color: "#B71C1C" },
  "991975": { code: "mellat", name: "بانک ملت", color: "#B71C1C" },
  "589463": { code: "refah", name: "بانک رفاه", color: "#1565C0" },
  "627353": { code: "tejarat", name: "بانک تجارت", color: "#283593" },
  "585983": { code: "tejarat", name: "بانک تجارت", color: "#283593" },
  "627381": { code: "ansar", name: "بانک انصار", color: "#2E7D32" },
  "639370": { code: "mehreqtesad", name: "مهر اقتصاد", color: "#00695C" },
  "606373": { code: "mehriran", name: "قرض‌الحسنه مهر ایران", color: "#388E3C" },
  "505785": { code: "iranzamin", name: "بانک ایران زمین", color: "#6A1B9A" },
  "505416": { code: "gardeshgari", name: "بانک گردشگری", color: "#AD1457" },
  "636949": { code: "hekmat", name: "حکمت ایرانیان", color: "#37474F" },
  "505801": { code: "kosar", name: "مؤسسه کوثر", color: "#00838F" },
  "628157": { code: "tosee", name: "مؤسسه توسعه", color: "#00838F" },
  "507677": { code: "noor", name: "مؤسسه نور", color: "#F9A825" },
  "606256": { code: "melal", name: "مؤسسه ملل", color: "#455A64" },
  "504172": { code: "resalat", name: "بانک رسالت", color: "#1B5E20" },
  "636795": { code: "markazi", name: "بانک مرکزی", color: "#263238" },
  "505809": { code: "khavarmianeh", name: "بانک خاورمیانه", color: "#4E342E" },
  "585947": { code: "khavarmianeh", name: "بانک خاورمیانه", color: "#4E342E" },
};

export function bankForCard(input: string): IranBank | null {
  const digits = cardDigits(input);
  if (digits.length < 6) return null;
  return BINS[digits.slice(0, 6)] ?? null;
}
