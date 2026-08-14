import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const gate = await adminGate("reconciliation.view");
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const id = (body.id ?? "").trim();
  const action = (body.action ?? "").trim();
  const note = (body.note ?? body.reason ?? "").trim();

  if (!id || !action) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  if (action === "resolve_financial" || action === "credit_wallet" || action === "mark_paid") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "اصلاح مالی فقط از مسیر AdjustmentRequest + maker-checker مجاز است. Mark Paid / Credit Wallet ممنوع است.",
      },
      { status: 403 }
    );
  }

  if (action === "resolve") {
    const write = await adminGate("reconciliation.resolve");
    if (!write.ok) return write.response;
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (action === "assign") patch.owner_id = gate.ctx.userId;
  if (action === "note" && note) patch.notes = note;
  if (action === "escalate") patch.status = "MANUAL_REVIEW";
  if (action === "resolve") {
    patch.status = "RESOLVED";
    patch.notes = note;
  }

  const { error } = await db.from("admin_reconciliation_items").update(patch).eq("id", id);
  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: `reconciliation.${action}`,
    entity: "reconciliation_item",
    entityId: id,
    reason: note || action,
    result: error ? "error" : "ok",
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "جدول تطبیق آماده نیست (NOT READY)." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, message: "به‌روز شد." });
}
