import { createAlert, disableAlert, listAlerts } from "@/lib/app/user-data";
import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireCoreUserId();
    return Response.json({ ok: true, alerts: await listAlerts(userId) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCoreUserId();
    if (!rateLimit(`alerts:${userId}`, 20, 60 * 60_000).ok) {
      return Response.json({ ok: false, error: "too_many", message: "تعداد درخواست زیاد است." }, { status: 429 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = await createAlert(userId, body);
    return Response.json({ ok: true, id, message: "هشدار قیمت ثبت شد. با رسیدن قیمت به هدف خبرتان می‌کنیم." });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireCoreUserId();
    await disableAlert(userId, new URL(request.url).searchParams.get("id"));
    return Response.json({ ok: true, message: "هشدار غیرفعال شد." });
  } catch (err) {
    return jsonError(err);
  }
}
