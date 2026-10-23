import { NextResponse } from "next/server";
import { authMethod, MIN_PASSWORD_LENGTH } from "@/lib/auth/method";

export const dynamic = "force-dynamic";

/** Tells the login page which sign-in flow is active. No secrets. */
export function GET() {
  return NextResponse.json(
    { ok: true, method: authMethod(), minPasswordLength: MIN_PASSWORD_LENGTH },
    { headers: { "Cache-Control": "no-store" } }
  );
}
