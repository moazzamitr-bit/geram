import { cookies } from "next/headers";
import { getExecutionMode } from "@/lib/core/mode";
import { CoreError } from "@/lib/core/types";
import { isSupabaseConfigured } from "@/lib/db/types";

export async function requireCoreUserId(): Promise<string> {
  if (isSupabaseConfigured()) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) return user.id;
    } catch {
      /* sandbox fallback below */
    }
  }

  if (getExecutionMode() === "PRODUCTION") {
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
  const message = err instanceof Error ? err.message : "internal_error";
  return Response.json({ ok: false, error: "internal_error", message }, { status: 500 });
}

export function readIdempotencyKey(request: Request, bodyKey?: string) {
  return (
    request.headers.get("idempotency-key") ||
    request.headers.get("Idempotency-Key") ||
    bodyKey ||
    crypto.randomUUID()
  );
}
