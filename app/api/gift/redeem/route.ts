import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { redeemGift } from "@/lib/gift/service";
import { assertVerified } from "@/lib/kyc/verification";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const FA: Record<string, string> = { GOLD: "طلا", SILVER: "نقره", COPPER: "مس" };

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    // Shared with preview: caps code guessing per user.
    const rl = rateLimit(`gift-try:${userId}`, 20, 10 * 60_000);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);
    await assertVerified(userId);
    const body = (await request.json().catch(() => ({}))) as { code?: unknown };
    const gift = await redeemGift(userId, String(body.code ?? ""));
    const g = (Number(gift.weight_ug) / 1_000_000).toLocaleString("fa-IR", { maximumFractionDigits: 4 });
    return Response.json({ ok: true, message: `هدیه دریافت شد! ${g} گرم ${FA[gift.asset]} به دارایی شما اضافه شد.` });
  } catch (err) {
    return jsonError(err);
  }
}
