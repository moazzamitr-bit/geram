import { replyTicket } from "@/lib/app/user-data";
import { jsonError, requireCoreUserId } from "@/lib/core/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireCoreUserId();
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await replyTicket(userId, id, body);
    return Response.json({ ok: true, message: "پیام شما ارسال شد." });
  } catch (err) {
    return jsonError(err);
  }
}
