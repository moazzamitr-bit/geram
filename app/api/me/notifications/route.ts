import { listNotifications, markNotificationsRead } from "@/lib/app/user-data";
import { jsonError, requireCoreUserId } from "@/lib/core/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    return Response.json({ ok: true, notifications: await listNotifications(userId) });
  } catch (err) {
    return jsonError(err);
  }
}

/** Body: { ids?: string[] } — omit ids to mark all as read. */
export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
    await markNotificationsRead(userId, body.ids);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
