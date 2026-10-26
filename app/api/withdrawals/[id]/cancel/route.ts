import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { transitionWithdrawal } from "@/lib/withdraw/service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireCoreUserId();
    const { id } = await params;
    const row = await transitionWithdrawal({ id, action: "cancel", actorId: userId, ownerId: userId });
    return Response.json({ ok: true, request: row, message: "درخواست لغو شد و مبلغ به کیف پول برگشت." });
  } catch (err) {
    return jsonError(err);
  }
}
