import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { applyReferralCode } from "@/lib/referral/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const body = (await request.json().catch(() => ({}))) as { code?: unknown };
    await applyReferralCode(userId, String(body.code ?? ""));
    return Response.json({
      ok: true,
      message: "کد دعوت ثبت شد. از این پس دوستتان از معاملات شما سهم می‌گیرد؛ از کارمزد شما چیزی کم نمی‌شود.",
    });
  } catch (err) {
    return jsonError(err);
  }
}
