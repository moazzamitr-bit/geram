import { cookies } from "next/headers";
import { getExecutionMode, isDeployedEnvironment } from "@/lib/core/mode";
import { CoreError } from "@/lib/core/types";
import { isSupabaseConfigured } from "@/lib/db/types";

/**
 * The unauthenticated `geram_sandbox_uid` cookie is client-controlled, so it is
 * only honoured on a local SANDBOX without Supabase. Anywhere else it would let
 * a caller act as any user id.
 */
export function sandboxCookieIdentityAllowed() {
  return (
    !isSupabaseConfigured() &&
    !isDeployedEnvironment() &&
    getExecutionMode() === "SANDBOX"
  );
}

export async function requireCoreUserId(): Promise<string> {
  if (isSupabaseConfigured()) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return user.id;
    throw new CoreError("unauthorized", "Authentication required", 401);
  }

  if (!sandboxCookieIdentityAllowed()) {
    throw new CoreError("unauthorized", "Authentication required", 401);
  }

  const jar = await cookies();
  return jar.get("geram_sandbox_uid")?.value || "demo-user-1";
}

export function jsonError(err: unknown) {
  if (err instanceof CoreError) {
    return Response.json(
      { ok: false, error: err.code, message: err.message },
      { status: err.httpStatus }
    );
  }
  console.error("core_api_error", err);
  return Response.json(
    { ok: false, error: "internal_error", message: "خطای داخلی سرور" },
    { status: 500 }
  );
}

export function readIdempotencyKey(request: Request, bodyKey?: string) {
  return (
    request.headers.get("idempotency-key") ||
    request.headers.get("Idempotency-Key") ||
    bodyKey ||
    crypto.randomUUID()
  );
}
