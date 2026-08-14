import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const gate = await adminGate("reconciliation.view");
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const action = (body.action ?? "create").trim();
  const reason = (body.reason ?? "").trim();

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  if (action === "create") {
    const kind = (body.kind ?? "").trim();
    if (!kind || reason.length < 8) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
    }
    const { data, error } = await db
      .from("admin_incidents")
      .insert({
        kind,
        severity: body.severity || "MEDIUM",
        status: "OPEN",
        asset: body.asset || null,
        correlation_id: body.correlationId || null,
        owner_id: gate.ctx.userId,
        notes: reason,
      })
      .select("id")
      .maybeSingle();
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: "incident.create",
      entity: "incident",
      entityId: data?.id ?? null,
      reason,
      result: error ? "error" : "ok",
      meta: { kind },
    });
    if (error) {
      return NextResponse.json({ ok: false, error: "جدول حوادث NOT READY است." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, message: "حادثه باز شد." });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (action === "investigate") patch.status = "INVESTIGATING";
  if (action === "mitigate") patch.status = "MITIGATED";
  if (action === "resolve") patch.status = "RESOLVED";
  if (reason) patch.notes = reason;
  const { error } = await db.from("admin_incidents").update(patch).eq("id", id);
  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: `incident.${action}`,
    entity: "incident",
    entityId: id,
    reason: reason || action,
    result: error ? "error" : "ok",
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: "به‌روز شد." });
}
