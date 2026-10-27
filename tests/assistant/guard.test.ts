import { describe, expect, it } from "vitest";
import { checkModelOutput, checkUserInput, refusalText } from "@/lib/assistant/guard";

describe("assistant input guard", () => {
  const refused: [string, string][] = [
    ["الان طلا بخرم یا نه؟", "advice"],
    ["آیا الان وقت خرید طلاست؟", "advice"],
    ["بخرم یا بفروشم؟", "advice"],
    ["نظرت درباره خرید سکه چیه؟", "advice"],
    ["پولمو روی طلا سرمایه گذاری کنم؟", "advice"],
    ["فروختن نقره الان میارزه؟", "advice"],
    ["should I buy gold now?", "advice"],
    ["قیمت طلا فردا چند میشه؟", "prediction"],
    ["طلا گرون میشه؟", "prediction"],
    ["پیش‌بینی قیمت طلا برای ماه آینده", "prediction"],
    ["دلار بالا میره؟", "prediction"],
    ["طلا میریزه؟", "prediction"],
    ["تارگت سکه چنده؟", "prediction"],
    ["اثر مذاکرات بر طلا چیه؟", "political"],
    ["اگه جنگ بشه طلا چی میشه؟", "political"],
    ["نظرت درباره رئیس‌جمهور چیه", "political"],
    ["تحریم‌ها روی قیمت سکه", "political"],
    ["انتخابات آمریکا و طلا", "political"],
  ];
  it.each(refused)("refuses %s", (q, reason) => {
    expect(checkUserInput(q)).toEqual({ ok: false, reason });
  });

  const allowed = [
    "حباب سکه یعنی چه؟",
    "چطور طلا بخرم؟",
    "قیمت الان طلای ۱۸ عیار چند است؟",
    "کارمزد خرید چقدر است؟",
    "تحویل فیزیکی چطور انجام می‌شود؟",
    "آدرس شعبه کجاست؟",
    "خرید پله‌ای چیست؟",
    "یک مثقال چند گرم است؟",
    "برداشت تومان به کدام حساب واریز می‌شود؟",
    "احراز هویت چطور انجام می‌شود؟",
  ];
  it.each(allowed)("allows %s", (q) => {
    expect(checkUserInput(q)).toEqual({ ok: true });
  });
});

describe("assistant output guard", () => {
  const blocked = [
    "با توجه به شرایط، پیشنهاد می‌کنم همین حالا طلا بخرید.",
    "الان زمان مناسبی برای خرید است.",
    "قیمت طلا در هفته آینده افزایش خواهد یافت.",
    "انتظار می‌رود قیمت سکه به ۹۰ میلیون برسد.",
    "احتمالاً قیمت نقره کاهش پیدا کند.",
    "به نظرم بهتر است فعلاً صبر کنید و بعد بخرید.",
    "با توجه به تحریم‌ها و مذاکرات، بازار نوسان دارد.",
    "این روش سود تضمینی دارد.",
  ];
  it.each(blocked)("blocks %s", (a) => {
    expect(checkModelOutput(a).ok).toBe(false);
  });

  const passed = [
    "حباب سکه یعنی اختلاف قیمت بازار سکه با ارزش طلای خالص آن.",
    "قیمت فعلی طلای ۱۸ عیار در گرم ۲۶٬۱۱۸٬۵۰۰ تومان است.",
    "برای خرید، از منوی معامله مقدار را وارد کنید؛ قیمت قطعی و کارمزد پیش از تأیید نشان داده می‌شود.",
    "خرید پله‌ای یعنی خرید مبلغ ثابت در فاصله‌های منظم. این توضیح یک مفهوم است، نه توصیه.",
    "یک مثقال حدود ۴.۶۰۸ گرم است.",
  ];
  it.each(passed)("passes %s", (a) => {
    expect(checkModelOutput(a)).toEqual({ ok: true });
  });

  it("refusals never contain advice themselves", () => {
    for (const r of ["advice", "prediction"] as const) expect(checkModelOutput(refusalText(r)).ok).toBe(true);
  });
});
