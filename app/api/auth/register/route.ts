import { NextResponse } from "next/server";
import { registerPhonePassword } from "@/lib/auth/accounts";
import { validateRegister } from "@/lib/auth/credentials";
import { readAuthBody, redirectTo, rejectCrossOrigin, wantsHtml } from "@/lib/auth/http";
import { normalizeIranMobile } from "@/lib/auth/phone";
import { isSupabaseConfigured } from "@/lib/db/types";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const ipLimit = rateLimit(`register:ip:${clientIp(request)}`, 10, 10 * 60 * 1000);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfterSec);

  const body = await readAuthBody(request);
  const phone = normalizeIranMobile(body.phone ?? "");
  const password = body.password ?? "";
  const passwordConfirm = body.passwordConfirm ?? body.password_confirm;
  const firstName = body.firstName ?? body.first_name ?? "";
  const lastName = body.lastName ?? body.last_name ?? "";
  const invalid = validateRegister({
    phone,
    password,
    passwordConfirm,
    firstName,
    lastName,
  });
  if (invalid) {
    return respond(request, { ok: false, error: invalid, status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return respond(request, { ok: false, error: "supabase_not_configured", status: 503 });
  }

  try {
    const result = await registerPhonePassword({ phone, password, firstName, lastName });
    return respond(request, result);
  } catch (err) {
    console.error("register", err instanceof Error ? err.message : "failed");
    return respond(request, { ok: false, error: "service_unavailable", status: 503 });
  }
}

function respond(
  request: Request,
  result:
    | { ok: true; session: { access_token: string; refresh_token: string }; profile: unknown; seal: <T extends NextResponse>(r: T) => T }
    | { ok: false; error: string; status: number; seal?: <T extends NextResponse>(r: T) => T }
) {
  const seal = result.seal ?? ((response) => response);
  if (wantsHtml(request)) {
    const path = result.ok ? "/auth/onboarding" : "/auth/login";
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
