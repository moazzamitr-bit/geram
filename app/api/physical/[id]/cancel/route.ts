import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { transitionPhysical } from "@/lib/physical/service";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireCoreUserId();
    const { id } = await params;
    const row = await transitionPhysical({ id, action: "cancel", actorId: userId, ownerId: userId });
    return Response.json({ ok: true, request: row, message: "درخواست لغو شد و فلز به موجودی شما برگشت." });
  } catch (err) {
    return jsonError(err);
  }
}
