/**
 * Fixed-window rate limiter kept in process memory.
 *
 * Good enough for a single server; on serverless (several instances) each
 * instance counts separately, so limits are per-instance there. Move to a
 * shared store (Postgres/Redis) before relying on it against a determined attacker.
 */
type Bucket = { count: number; resetAt: number };

const g = globalThis as unknown as { __geramRate?: Map<string, Bucket> };
const buckets = (g.__geramRate ??= new Map<string, Bucket>());

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 50_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(request: Request) {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim();
}

export function tooManyRequests(retryAfterSec: number) {
  return Response.json(
    { ok: false, error: "rate_limited", message: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
