import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { assertVerified } from "@/lib/kyc/verification";
import { createGift, GIFT_LIMITS, GIFT_TTL_DAYS, listUserGifts } from "@/lib/gift/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    const limits = Object.fromEntries(
      Object.entries(GIFT_LIMITS).map(([k, v]) => [k, { minUg: v.minUg.toString(), maxUg: v.maxUg.toString() }])
    );
    return Response.json({ ok: true, gifts: await listUserGifts(userId), limits, ttlDays: GIFT_TTL_DAYS });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    await assertVerified(userId);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const gift = await createGift({ userId, asset: body.asset, weightUg: body.weightUg, message: body.message });
    return Response.json({
      ok: true,
      gift,
      message: `کارت هدیه ساخته شد. کد ${gift.code} را برای گیرنده بفرستید؛ تا ${GIFT_TTL_DAYS.toLocaleString("fa-IR")} روز اعتبار دارد و اگر دریافت نشود به دارایی شما برمی‌گردد.`,
    });
  } catch (err) {
    return jsonError(err);
  }
}
