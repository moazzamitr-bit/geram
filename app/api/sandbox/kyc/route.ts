import { NextResponse } from "next/server";
import { z } from "zod";
import { getExecutionMode } from "@/lib/core/mode";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "NEEDS_UPDATE"]),
});

/**
 * Sandbox-only KYC simulator. Users can no longer write profiles.kyc_status
 * themselves (RLS guard), so the simulation goes through the service role and
 * is refused outside SANDBOX.
 */
export async function POST(request: Request) {
  let mode: string;
  try {
    mode = getExecutionMode();
  } catch {
    mode = "UNKNOWN";
  }
  if (mode !== "SANDBOX") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ kyc_status: parsed.data.status })
    .eq("id", user.id);
  if (error) {
    console.error("sandbox_kyc", error.message);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: parsed.data.status });
}
