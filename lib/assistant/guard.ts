/**
 * Server-side guard for دستیار گرم. The assistant is informational only:
 * no buy/sell/hold advice, no price predictions or targets, no politics.
 * Both the user's question and the model's answer pass through here.
 */

export const ASSISTANT_DISCLAIMER =
  "این دستیار مشاور سرمایه‌گذاری نیست و توصیه خرید، فروش یا نگهداری نمی‌دهد. تصمیم معامله با خود شماست.";

export type GuardVerdict = { ok: true } | { ok: false; reason: "advice" | "prediction" | "political" };

/** Normalise Arabic letters, ZWNJ and digits so patterns match spelling variants. */
export function normalizeFa(input: string): string {
  return input
    .replace(/[\u200c\u200f\u200e]/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

const MI = "می ?"; // «می‌» with or without space after normalisation

const POLITICAL = [
  /انتخابات/, /تحریم/, /برجام/, /مذاکر/, /جنگ/, /اسرائیل/, /آمریکا/, /امریکا/, /ترامپ/, /بایدن/,
  /رهبر/, /خامنه/, /رئیس ?جمهور/, /رییس ?جمهور/, /مجلس/, /سپاه/, /اعتراض/, /سیاس/, /حمله/, /نظامی/,
  /\b(politic|election|sanction|war|israel|trump)/,
];

const ADVICE_IN = [
  /(بخرم|بفروشم|بخریم|بفروشیم) ?یا/,
  /آیا .{0,30}(بخرم|بفروشم|بخریم|نگه دارم|سرمایه ?گذاری کنم)/,
  /(الان|امروز|فردا|این هفته|فعلا|فعلاً|الآن).{0,25}(بخرم|بفروشم|بخریم|خرید کنم|فروش کنم|وقت خرید|وقت فروش|زمان خرید|زمان فروش)/,
  /(بخرم|بفروشم|بخریم|بخرید|بفروشید|نگه دارم) ?(بهتره|بهتر است|خوبه|عاقلانه)/,
  /(وقت|زمان) ?(خوب|مناسب|خوبی|مناسبی)? ?(برای )?(خرید|فروش)(ه| است| هست)/,
  /(توصیه|پیشنهاد|نظرت|نظر شما|نظر تو).{0,30}(خرید|فروش|بخرم|بفروشم|سرمایه ?گذاری|سود)/,
  /(چی|چه چیزی|کدام|کدوم).{0,20}(بخرم|سود بیشتر|بهتره بخرم|سرمایه ?گذاری کنم)/,
  /(سرمایه ?گذاری|پولمو|پولم را|پولم رو).{0,30}(روی|تو|در).{0,20}(طلا|نقره|مس|سکه|دلار)/,
  /(ارزش داره|میارزه|می ?ارزه|صرف ?می ?کنه|سود ?می ?کنم)/,
  /\b(should i (buy|sell|hold)|buy or sell|good time to (buy|sell))/,
];

const PREDICTION_IN = [
  /پیش ?بینی/, /تارگت/, /هدف ?قیمت/, /سقف ?قیمت/, /کف ?قیمت/,
  /(گرون|گران|ارزون|ارزان) ?(تر )?(می ?شه|میشه|می ?شود|خواهد|میشن)/,
  /(بالا|پایین) ?(می ?ره|میره|می ?رود|خواهد|میاد|می ?آید)/,
  /(می ?ریزه|میریزه|ریزش می|ریزش داره|ریزش خواهد|سقوط می)/,
  /قیمت.{0,30}(فردا|هفته بعد|هفته آینده|ماه بعد|ماه آینده|آینده|سال بعد|سال آینده|چند وقت دیگه)/,
  /(فردا|هفته بعد|ماه بعد|آینده).{0,30}قیمت/,
  /\b(predict|forecast|price target)/,
];

const ADVICE_OUT = [
  new RegExp(`(توصیه|پیشنهاد) ?(${MI}کنم|میکنم|من این است)`),
  /(بخرید|بفروشید|نگه دارید|خرید کنید|بفروشید|وارد شوید|خارج شوید)[.!،؛ ]*$/m,
  /(الان|اکنون|همین حالا|فعلا|فعلاً|امروز).{0,30}(زمان|وقت|فرصت) ?(خوب|مناسب|طلایی)/,
  /(زمان|وقت|فرصت) ?(خوب|مناسب|خوبی|مناسبی|طلایی) ?(برای )?(خرید|فروش|ورود|خروج)/,
  /(بهتر است|بهتره|عاقلانه است) .{0,30}(بخرید|بفروشید|نگه دارید|صبر کنید|خرید کنید)/,
  /(سود|بازده) ?(تضمینی|قطعی|تضمین)/,
  /\b(you should (buy|sell|hold)|i recommend (buying|selling))/,
];

const PREDICTION_OUT = [
  /پیش ?بینی (می ?کنم|میکنم|من)/,
  /(تارگت|هدف قیمتی|سقف قیمتی بعدی)/,
  /(افزایش|کاهش|رشد|ریزش|بالا|پایین|گران|ارزان) ?(تر )?(خواهد|خواهند)/,
  new RegExp(`انتظار ${MI}رود.{0,40}(افزایش|کاهش|رشد|ریزش|برسد)`),
  /احتمالا?ً? .{0,25}(افزایش|کاهش|رشد|ریزش|گران|ارزان)/,
  /(به|تا) .{0,20}(تومان|میلیون).{0,10}(خواهد رسید|می ?رسد|برسد)/,
];

function hit(text: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(text));
}

export function checkUserInput(raw: string): GuardVerdict {
  const t = normalizeFa(raw);
  if (hit(t, POLITICAL)) return { ok: false, reason: "political" };
  if (hit(t, PREDICTION_IN)) return { ok: false, reason: "prediction" };
  if (hit(t, ADVICE_IN)) return { ok: false, reason: "advice" };
  return { ok: true };
}

export function checkModelOutput(raw: string): GuardVerdict {
  const t = normalizeFa(raw);
  if (hit(t, POLITICAL)) return { ok: false, reason: "political" };
  if (hit(t, PREDICTION_OUT)) return { ok: false, reason: "prediction" };
  if (hit(t, ADVICE_OUT)) return { ok: false, reason: "advice" };
  return { ok: true };
}

export function refusalText(reason: "advice" | "prediction" | "political"): string {
  if (reason === "political") {
    return "دستیار گرم وارد موضوعات و تحلیل‌های سیاسی نمی‌شود. اگر درباره قیمت لحظه‌ای، مفاهیم بازار طلا یا نحوه کار با گرم سؤال دارید، خوشحال می‌شوم کمک کنم.";
  }
  if (reason === "prediction") {
    return "من قیمت آینده را پیش‌بینی نمی‌کنم و عدد هدف برای قیمت نمی‌دهم؛ هیچ‌کس نمی‌تواند قیمت آینده را با اطمینان بگوید. می‌توانم قیمت لحظه‌ای را نشان دهم یا عوامل کلی اثرگذار بر قیمت طلا و مفاهیمی مثل حباب سکه را توضیح دهم.";
  }
  return `من توصیه خرید، فروش یا نگهداری نمی‌دهم. ${ASSISTANT_DISCLAIMER} می‌توانم مفاهیمی مثل خرید پله‌ای، کارمزد و نحوه انجام معامله در گرم را توضیح دهم.`;
}
