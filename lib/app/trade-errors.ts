/**
 * Turn core/API failures into a sentence the trade form can show.
 * Persian messages pass through. Known English codes are translated.
 */
export function tradeFailureMessage(raw: string | undefined, fallback: string): string {
  const text = (raw ?? "").trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();
  if (lower.includes("insufficient_funds") || text.includes("موجودی کیف پول")) {
    return "موجودی کیف پول کافی نیست.";
  }
  if (lower.includes("insufficient_inventory") || lower.includes("not enough metal")) {
    return "موجودی فلز کافی نیست.";
  }
  if (lower.includes("price_stale")) {
    return "قیمت بازار کهنه شده است. چند لحظه بعد دوباره قیمت بگیرید.";
  }
  if (lower.includes("price_unavailable")) {
    return "دریافت قیمت از بازار ممکن نشد. کمی بعد دوباره تلاش کنید.";
  }
  if (lower.includes("not_executable")) {
    return "این قیمت فعلاً برای خرید و فروش قابل اجرا نیست.";
  }
  if (text.includes("مقدار فلز")) return text;
  if (
    lower.includes("quote_expired") ||
    lower.includes("quote expired") ||
    text.includes("اعتبار قیمت")
  ) {
    return "اعتبار قیمت تمام شد. قیمت جدید بگیرید.";
  }
  const persian = text.replace(/^[a-z0-9_:-]+\s+/i, "");
  if (/[\u0600-\u06FF]/.test(persian)) return persian;
  return fallback;
}
