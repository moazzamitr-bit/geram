import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { assertVerified } from "@/lib/kyc/verification";
import { updateSavingsPlan } from "@/lib/savings/service";

export const dynamic = "force-dynamic";

const DONE: Record<string, string> = {
  pause: "طرح متوقف شد. تا فعال‌سازی دوباره خریدی انجام نمی‌شود.",
  resume: "طرح دوباره فعال شد.",
  cancel: "طرح لغو شد. خریدهای قبلی در کیف پول شما باقی می‌ماند.",
};

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireCoreUserId();
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action === "resume") await assertVerified(userId);
    const { id } = await ctx.params;
    const plan = await updateSavingsPlan(userId, id, body.action);
    return Response.json({ ok: true, plan, message: DONE[String(body.action)] });
  } catch (err) {
    return jsonError(err);
  }
}
