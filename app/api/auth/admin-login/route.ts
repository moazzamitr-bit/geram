import { NextResponse } from "next/server";
import { loginAdmin } from "@/lib/auth/accounts";
import { validateAdminLogin } from "@/lib/auth/credentials";
import { readAuthBody, redirectTo, rejectCrossOrigin, wantsHtml } from "@/lib/auth/http";
import { isSupabaseConfigured } from "@/lib/db/types";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const ipLimit = rateLimit(`adminlogin:ip:${clientIp(request)}`, 20, 10 * 60 * 1000);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfterSec);

  const body = await readAuthBody(request);
  const email = body.email ?? "";
  const password = body.password ?? "";
  const invalid = validateAdminLogin(email, password);
  if (invalid) {
    return respond(request, { ok: false, error: invalid, status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return respond(request, { ok: false, error: "supabase_not_configured", status: 503 });
  }

  try {
    const result = await loginAdmin(email, password);
    return respond(request, result);
  } catch (err) {
    console.error("admin_login", err instanceof Error ? err.message : "failed");
    return respond(request, { ok: false, error: "timeout", status: 504 });
  }
}

function respond(
  request: Request,
  result:
    | { ok: true; seal: <T extends NextResponse>(r: T) => T }
    | { ok: false; error: string; status: number; seal?: <T extends NextResponse>(r: T) => T }
) {
  const seal = result.seal ?? ((response) => response);
  if (wantsHtml(request)) {
    const path = result.ok ? "/admin" : "/admin/login";
    const query = new URLSearchParams();
    if (!result.ok) query.set("error", result.error);
    const suffix = query.toString();
    return seal(redirectTo(request, suffix ? `${path}?${suffix}` : path));
  }
  if (!result.ok) {
    return seal(NextResponse.json({ ok: false, error: result.error }, { status: result.status }));
  }
  return seal(NextResponse.json({ ok: true }));
}
