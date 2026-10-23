import { NextResponse } from "next/server";
import { loginPhonePassword } from "@/lib/auth/accounts";
import { validateRegister } from "@/lib/auth/credentials";
import { readAuthBody, redirectTo, rejectCrossOrigin, wantsHtml } from "@/lib/auth/http";
import { authMethod } from "@/lib/auth/method";
import { normalizeIranMobile } from "@/lib/auth/phone";
import { registerPhoneUser } from "@/lib/db/phone-auth";
import { isSupabaseConfigured } from "@/lib/db/types";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Failure = {
  ok: false;
  error: string;
  status: number;
  seal?: <T extends NextResponse>(response: T) => T;
};

/** Mobile + password sign-up (AUTH_METHOD=password). Signs the user in on success. */
export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  if (authMethod() !== "password") {
    return respond(request, { ok: false, error: "method_disabled", status: 403 });
  }

  const ip = rateLimit(`register:ip:${clientIp(request)}`, 10, 60 * 60 * 1000);
  if (!ip.ok) return tooManyRequests(ip.retryAfterSec);

  const body = await readAuthBody(request);
  const phone = normalizeIranMobile(body.phone ?? "");
  const password = body.password ?? "";
  const passwordConfirm = body.passwordConfirm ?? body.password_confirm;
  const firstName = (body.firstName ?? body.first_name ?? "").trim();
  const lastName = (body.lastName ?? body.last_name ?? "").trim();
  const invalid = validateRegister({ phone, password, passwordConfirm, firstName, lastName });
  if (invalid) {
    return respond(request, { ok: false, error: invalid, status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return respond(request, { ok: false, error: "supabase_not_configured", status: 503 });
  }

  try {
    const created = await registerPhoneUser({ phone, password, firstName, lastName });
    if (!created.ok) {
      const status =
        created.error === "already_registered" ? 409 : created.error === "service_unavailable" ? 503 : 500;
      return respond(request, { ok: false, error: created.error, status });
    }

    const result = await loginPhonePassword(phone, password);
    if (!result.ok) {
      return respond(request, { ok: false, error: "sign_in_failed", status: 500, seal: result.seal });
    }
    return respond(request, {
      ...result,
      profile: { ...result.profile, onboarding_done: false },
    });
  } catch (err) {
    console.error("register", err instanceof Error ? err.message : "failed");
    return respond(request, { ok: false, error: "service_unavailable", status: 503 });
  }
}

function respond(
  request: Request,
  result:
    | {
        ok: true;
        session: { access_token: string; refresh_token: string };
        profile: { onboarding_done?: boolean | null };
        seal: <T extends NextResponse>(response: T) => T;
      }
    | Failure
) {
  const seal = result.seal ?? (<T extends NextResponse>(response: T) => response);
  if (wantsHtml(request)) {
    const path = result.ok
      ? result.profile.onboarding_done
        ? "/app/dashboard"
        : "/auth/onboarding"
      : "/auth/login";
    const query = new URLSearchParams();
    if (!result.ok) {
      query.set("error", result.error);
      query.set("tab", "register");
    }
    const suffix = query.toString();
    return seal(redirectTo(request, suffix ? `${path}?${suffix}` : path));
  }
  if (!result.ok) {
    return seal(NextResponse.json({ ok: false, error: result.error }, { status: result.status }));
  }
  return seal(NextResponse.json({ ok: true, session: result.session, profile: result.profile }));
}
