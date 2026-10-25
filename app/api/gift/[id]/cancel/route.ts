import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { cancelGift } from "@/lib/gift/service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireCoreUserId();
    const { id } = await ctx.params;
    await cancelGift(userId, id);
    return Response.json({ ok: true, message: "کارت هدیه لغو شد و فلز به دارایی شما برگشت." });
  } catch (err) {
    return jsonError(err);
  }
}
