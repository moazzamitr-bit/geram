import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { CoreError } from "@/lib/core/types";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { effectiveTradeLimits } from "@/lib/kyc/levels";
import { assertVerified, readVerification } from "@/lib/kyc/verification";
import { MIN_WITHDRAW_TOMAN } from "@/lib/withdraw/rules";
import {
  createWithdrawal,
  listPayoutCards,
  listUserWithdrawals,
  withdrawalsEnabled,
  withdrawUsage,
} from "@/lib/withdraw/service";

export const dynamic = "force-dynamic";

/** Payout cards (verified cards with their IBAN), today's cap and the user's requests. */
export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const [cards, requests, settings, kyc, used] = await Promise.all([
      listPayoutCards(userId),
      listUserWithdrawals(userId),
      loadCommerceSettings(),
      readVerification(userId),
      withdrawUsage(userId),
    ]);
    const cap = effectiveTradeLimits(settings.limits, kyc.level).dailyWithdrawToman;
    return Response.json({
      ok: true,
      enabled: withdrawalsEnabled(),
      cards,
      requests,
      dailyCapToman: cap,
      usedTodayToman: used,
      minToman: MIN_WITHDRAW_TOMAN,
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    await assertVerified(userId);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.cardId !== "string") throw new CoreError("invalid_card", "کارت مقصد را انتخاب کنید.", 400);
    const row = await createWithdrawal({ userId, cardId: body.cardId, amountToman: Number(body.amountToman) });
    return Response.json({
      ok: true,
      request: row,
      message: `درخواست برداشت ثبت شد و مبلغ تا واریز رزرو است. کد پیگیری: ${row.tracking_code}`,
    });
  } catch (err) {
    return jsonError(err);
  }
}
