import { NextResponse } from "next/server";
import { loginPhonePassword } from "@/lib/auth/accounts";
import { validatePasswordLogin } from "@/lib/auth/credentials";
import { readAuthBody, redirectTo, rejectCrossOrigin, wantsHtml } from "@/lib/auth/http";
import { authMethod } from "@/lib/auth/method";
import { normalizeIranMobile } from "@/lib/auth/phone";
import { isSupabaseConfigured } from "@/lib/db/types";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Failure = {
  ok: false;
  error: string;
  status: number;
  seal?: <T extends NextResponse>(response: T) => T;
};

/** Mobile + password sign-in (AUTH_METHOD=password). JSON for the app, 303 for a native form post. */
export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  if (authMethod() !== "password") {
    return respond(request, { ok: false, error: "method_disabled", status: 403 }, "/auth/login");
  }

  const ip = rateLimit(`pwlogin:ip:${clientIp(request)}`, 30, 10 * 60 * 1000);
  if (!ip.ok) return tooManyRequests(ip.retryAfterSec);

  const body = await readAuthBody(request);
  const phone = normalizeIranMobile(body.phone ?? "");
  const password = body.password ?? "";
  const invalid = validatePasswordLogin(phone, password);
  if (invalid) {
    return respond(request, { ok: false, error: invalid, status: 400 }, "/auth/login");
  }

  if (!isSupabaseConfigured()) {
    return respond(
      request,
      { ok: false, error: "supabase_not_configured", status: 503 },
      "/auth/login"
    );
  }

  // Per-number cap slows password guessing against one account.
  const perPhone = rateLimit(`pwlogin:phone:${phone}`, 10, 10 * 60 * 1000);
  if (!perPhone.ok) return tooManyRequests(perPhone.retryAfterSec);

  try {
    const result = await loginPhonePassword(phone, password);
    const next = result.ok
      ? result.profile.onboarding_done
        ? "/app/dashboard"
        : "/auth/onboarding"
      : "/auth/login";
    return respond(request, result, next);
  } catch (err) {
    console.error("password_login", err instanceof Error ? err.message : "failed");
    return respond(request, { ok: false, error: "service_unavailable", status: 503 }, "/auth/login");
  }
}

function respond(
  request: Request,
  result:
    | {
        ok: true;
        session: { access_token: string; refresh_token: string };
        profile: unknown;
        seal: <T extends NextResponse>(response: T) => T;
      }
    | Failure,
  htmlPath: string
) {
  const seal = result.seal ?? (<T extends NextResponse>(response: T) => response);
  if (wantsHtml(request)) {
    const query = new URLSearchParams();
    if (!result.ok) query.set("error", result.error);
    const suffix = query.toString();
    return seal(redirectTo(request, suffix ? `${htmlPath}?${suffix}` : htmlPath));
  }
  if (!result.ok) {
    return seal(NextResponse.json({ ok: false, error: result.error }, { status: result.status }));
  }
  return seal(NextResponse.json({ ok: true, session: result.session, profile: result.profile }));
}
