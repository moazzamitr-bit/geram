import { createHash } from "crypto";
import { requireCoreUserId, jsonError } from "@/lib/core/http";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { assistantEnabled } from "@/lib/assistant/flag";
import { ASSISTANT_DISCLAIMER, checkModelOutput, checkUserInput, refusalText } from "@/lib/assistant/guard";
import { buildSystemPrompt, priceContext } from "@/lib/assistant/knowledge";
import { completeChat, providerConfigured, ProviderError, type ChatMessage } from "@/lib/assistant/provider";
import { getLivePrices } from "@/lib/market/price-provider";

export const dynamic = "force-dynamic";

const MAX_INPUT = 600;
const MAX_HISTORY = 6;

const off = () => Response.json({ ok: false, error: "disabled" }, { status: 404 });

export async function GET() {
  try {
    await requireCoreUserId();
  } catch {
    return Response.json({ ok: true, enabled: false });
  }
  const enabled = (await assistantEnabled()) && providerConfigured();
  return Response.json({ ok: true, enabled, disclaimer: ASSISTANT_DISCLAIMER });
}

function log(userId: string, meta: Record<string, unknown>) {
  const uid = createHash("sha256").update(userId).digest("hex").slice(0, 12);
  console.info("[assistant]", JSON.stringify({ uid, ...meta }));
}

export async function POST(request: Request) {
  if (!(await assistantEnabled())) return off();
  let userId: string;
  try {
    userId = await requireCoreUserId();
  } catch (err) {
    return jsonError(err);
  }
  const perUser = rateLimit(`assistant:u:${userId}`, 20, 60 * 60_000);
  if (!perUser.ok) return tooManyRequests(perUser.retryAfterSec);
  const perIp = rateLimit(`assistant:ip:${clientIp(request)}`, 60, 60 * 60_000);
  if (!perIp.ok) return tooManyRequests(perIp.retryAfterSec);
  const burst = rateLimit(`assistant:b:${userId}`, 4, 60_000);
  if (!burst.ok) return tooManyRequests(burst.retryAfterSec);

  const body = (await request.json().catch(() => ({}))) as { message?: unknown; history?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_INPUT) {
    return Response.json({ ok: false, error: "invalid_message", message: `پیام باید بین ۱ تا ${MAX_INPUT.toLocaleString("fa-IR")} نویسه باشد.` }, { status: 400 });
  }
  const started = Date.now();

  const input = checkUserInput(message);
  if (!input.ok) {
    log(userId, { len: message.length, guard: `in:${input.reason}` });
    return Response.json({ ok: true, reply: refusalText(input.reason), guarded: true });
  }
  if (!providerConfigured()) {
    return Response.json({ ok: false, error: "not_configured", message: "دستیار هنوز راه‌اندازی نشده است." }, { status: 503 });
  }

  const history: ChatMessage[] = (Array.isArray(body.history) ? body.history : [])
    .filter((m): m is { role: string; content: string } => !!m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 1200) }))
    // Drop earlier user turns that the guard would refuse, so they cannot steer the model.
    .filter((m) => m.role === "assistant" || checkUserInput(m.content).ok);

  let prices = "قیمت لحظه‌ای در دسترس نیست.";
  try {
    prices = priceContext(await getLivePrices());
  } catch {
    /* keep fallback text */
  }

  try {
    const raw = await completeChat([{ role: "system", content: buildSystemPrompt(prices) }, ...history, { role: "user", content: message }]);
    const out = checkModelOutput(raw);
    log(userId, { len: message.length, ms: Date.now() - started, guard: out.ok ? "pass" : `out:${out.reason}` });
    return Response.json({ ok: true, reply: out.ok ? raw : refusalText(out.reason), guarded: !out.ok });
  } catch (err) {
    const code = err instanceof ProviderError ? err.code : "upstream";
    log(userId, { len: message.length, ms: Date.now() - started, error: code });
    return Response.json(
      { ok: false, error: code, message: code === "timeout" ? "پاسخ دستیار طول کشید. لطفاً دوباره تلاش کنید." : "دستیار در حال حاضر در دسترس نیست. کمی بعد تلاش کنید." },
      { status: code === "timeout" ? 504 : 502 }
    );
  }
}
