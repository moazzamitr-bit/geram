import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/admin/rbac";

export async function POST(request: Request) {
  const gate = await adminGate("admin.manage");
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const userId = (body.userId ?? "").trim();
  const adminRole = (body.adminRole ?? "").trim();
  const reason = (body.reason ?? "").trim();
  if (!userId || !ADMIN_ROLES.includes(adminRole as (typeof ADMIN_ROLES)[number]) || reason.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  const { error } = await db.from("admin_role_assignments").upsert({
    user_id: userId,
    admin_role: adminRole,
    assigned_by: gate.ctx.userId,
    reason,
    assigned_at: new Date().toISOString(),
  });

  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: "admin.role.assign",
    entity: "admin_role",
    entityId: userId,
    reason,
    result: error ? "error" : "ok",
    meta: { adminRole },
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "جدول نقش‌ها NOT READY است. تا اعمال مایگریشن همه ادمین‌ها SUPER_ADMIN هستند." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, message: "نقش ذخیره شد." });
}
