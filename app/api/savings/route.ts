import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { assertVerified } from "@/lib/kyc/verification";
import { createSavingsPlan, savingsOverview } from "@/lib/savings/service";
import { CADENCE_LABEL } from "@/lib/savings/schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    return Response.json({ ok: true, ...(await savingsOverview(userId)) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    await assertVerified(userId);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const plan = await createSavingsPlan(userId, {
      asset: body.asset,
      amountToman: body.amountToman,
      cadence: body.cadence,
    });
    const when = new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(plan.nextRunAt));
    return Response.json({
      ok: true,
      plan,
      message: `طرح پس‌انداز ${CADENCE_LABEL[plan.cadence]} ساخته شد. اولین خرید ${when} از موجودی کیف پول انجام می‌شود.`,
    });
  } catch (err) {
    return jsonError(err);
  }
}
