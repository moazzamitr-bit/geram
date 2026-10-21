import type { FinancialCore } from "@/lib/core/engine";
import { irrToSafeTomanNumber } from "@/lib/core/money";
import { CoreError } from "@/lib/core/types";
import type { LimitSettings } from "@/lib/commerce/types";

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

/** Start of the current day in Tehran, as a UTC timestamp. */
export function tehranDayStart(now = new Date()): number {
  const local = now.getTime() + TEHRAN_OFFSET_MS;
  const dayStartLocal = local - (local % (24 * 60 * 60 * 1000));
  return dayStartLocal - TEHRAN_OFFSET_MS;
}

export async function usedToday(core: FinancialCore, userId: string, now = new Date()) {
  const since = tehranDayStart(now);
  const { trades } = await core.listActivity(userId);
  let buy = 0;
  let sell = 0;
  for (const t of trades) {
    if (t.status !== "SETTLED" || new Date(t.createdAt).getTime() < since) continue;
    const toman = irrToSafeTomanNumber(t.grossIrr);
    if (t.side === "BUY") buy += toman;
    else sell += toman;
  }
  return { buyToman: buy, sellToman: sell };
}

export async function assertWithinDailyLimit(input: {
  core: FinancialCore;
  userId: string;
  side: "BUY" | "SELL";
  requestedToman: number;
  limits: LimitSettings;
}) {
  const used = await usedToday(input.core, input.userId);
  const cap = input.side === "BUY" ? input.limits.dailyBuyToman : input.limits.dailySellToman;
  const spent = input.side === "BUY" ? used.buyToman : used.sellToman;
  if (cap > 0 && spent + input.requestedToman > cap) {
    throw new CoreError(
      "daily_limit",
      `از سقف روزانه ${input.side === "BUY" ? "خرید" : "فروش"} بیشتر است. باقیمانده امروز: ${Math.max(0, cap - spent).toLocaleString("fa-IR")} تومان`,
      409
    );
  }
}
