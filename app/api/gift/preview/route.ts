import { jsonError, requireCoreUserId } from "@/lib/core/http";
import { previewGift } from "@/lib/gift/service";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await requireCoreUserId();
    const rl = rateLimit(`gift-try:${userId}`, 20, 10 * 60_000);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);
    const code = new URL(request.url).searchParams.get("code") ?? "";
    return Response.json({ ok: true, gift: await previewGift(code) });
  } catch (err) {
    return jsonError(err);
  }
}
