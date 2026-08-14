import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const gate = await adminGate("security.act");
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const userId = (body.userId ?? "").trim();
  const reason = (body.reason ?? "").trim();
  if (!userId || reason.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  const { error } = await db.auth.admin.signOut(userId, "global");
  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: "session.revoke_all",
    entity: "user",
    entityId: userId,
    reason,
    result: error ? "error" : "ok",
    meta: { error: error?.message ?? null },
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: "همه نشست‌های Auth لغو شد." });
}
