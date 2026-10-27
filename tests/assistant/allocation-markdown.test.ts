import { describe, expect, it } from "vitest";
import { checkModelOutput, checkUserInput, refusalText } from "@/lib/assistant/guard";
import { buildSystemPrompt } from "@/lib/assistant/knowledge";
import { parseInline, parseMarkdown, safeHref } from "@/lib/assistant/markdown";

describe("personal allocation questions", () => {
  it.each([
    "اگه جای من بودی با ۵۰ میلیون چی کار می‌کردی؟",
    "اگه جای من بودی با 50 میلیون چیکار میکردی",
    "چند درصد پولم رو طلا کنم؟",
    "چند درصد از سرمایه‌ام رو نقره بخرم؟",
    "چقدر طلا داشته باشم؟",
    "سبد دارایی من رو چطور بچینم؟",
    "پس‌اندازم رو چطور بین طلا و نقره تقسیم کنم؟",
    "با ۲۰۰ میلیون تومن چی بخرم؟",
    "اگر تو بودی چه می‌کردی؟",
  ])("refuses %s as allocation", (q) => {
    expect(checkUserInput(q)).toEqual({ ok: false, reason: "allocation" });
  });

  it.each(["خرید پله‌ای چیه؟", "پس‌انداز دوره‌ای در گرم چطور کار می‌کند؟", "کارمزد خرید چقدره؟", "حباب سکه چیه؟"])(
    "still allows educational %s",
    (q) => expect(checkUserInput(q)).toEqual({ ok: true })
  );

  it.each([
    "بهتر است ۳۰ درصد سرمایه را طلا کنید.",
    "همه پولتان را در یک دارایی متمرکز نکنید.",
    "بخشی از پس‌انداز را برای طلا کنار بگذارید.",
    "اگر جای شما بودم کمی نقره هم می‌خریدم.",
    "سرمایه را بین طلا و نقره تقسیم کنید.",
  ])("output guard blocks allocation advice: %s", (a) => {
    expect(checkModelOutput(a)).toEqual({ ok: false, reason: "allocation" });
  });

  it("output guard passes neutral DCA explanation", () => {
    expect(
      checkModelOutput("خرید پله‌ای یعنی به‌جای خرید یکجا، مبلغ ثابتی را در فاصله‌های منظم خرید کنید تا میانگین قیمت خرید متعادل شود.")
    ).toEqual({ ok: true });
  });

  it("refusal is polite, educational, and itself passes the output guard", () => {
    const r = refusalText("allocation");
    expect(r).toContain("خرید پله‌ای");
    expect(r).toContain("مشاور");
    expect(r).not.toMatch(/[0-9۰-۹]+ ?(٪|درصد)/);
  });

  it("system prompt forbids allocation and heavy formatting", () => {
    const p = buildSystemPrompt("-");
    expect(p).toContain("تخصیص");
    expect(p).toContain("قالب‌بندی: حداقلی");
  });
});

describe("assistant markdown", () => {
  it("bold, lists, paragraphs and line breaks", () => {
    const b = parseMarkdown("قیمت: **۲۶٬۲۱۲٬۰۰۰ تومان**\nتغییر: مثبت\n\n- یک\n- **دو**\n\n۱. اول\n2) دوم");
    expect(b).toEqual([
      { t: "p", lines: [[{ t: "text", v: "قیمت: " }, { t: "bold", v: "۲۶٬۲۱۲٬۰۰۰ تومان" }], [{ t: "text", v: "تغییر: مثبت" }]] },
      { t: "ul", items: [[{ t: "text", v: "یک" }], [{ t: "bold", v: "دو" }]] },
      { t: "ol", items: [[{ t: "text", v: "اول" }], [{ t: "text", v: "دوم" }]] },
    ]);
  });

  it("raw HTML stays literal text", () => {
    const b = parseMarkdown('<img src=x onerror="alert(1)"><script>x</script>');
    expect(b).toEqual([{ t: "p", lines: [[{ t: "text", v: '<img src=x onerror="alert(1)"><script>x</script>' }]] }]);
  });

  it("links only to geram.co", () => {
    expect(parseInline("[پنل](https://geram.co/app)")).toEqual([{ t: "link", v: "پنل", href: "https://geram.co/app" }]);
    expect(parseInline("[ابزار](/app/trade/gold)")).toEqual([{ t: "link", v: "ابزار", href: "/app/trade/gold" }]);
    expect(parseInline("[x](https://evil.com/geram.co)")).toEqual([{ t: "text", v: "x" }]);
    expect(parseInline("[x](javascript:alert(1))").some((n) => n.t === "link")).toBe(false);
    expect(safeHref("https://geram.co.evil.com")).toBeNull();
    expect(safeHref("http://geram.co")).toBeNull();
    expect(safeHref("//evil.com")).toBeNull();
  });

  it("headings become bold, stray asterisks removed", () => {
    expect(parseMarkdown("## عنوان\nمتن **ناقص")).toEqual([
      { t: "p", lines: [[{ t: "bold", v: "عنوان" }], [{ t: "text", v: "متن ناقص" }]] },
    ]);
  });
});
