import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";

const KINDS = new Set([
  "FINANCIAL_ADJUSTMENT",
  "INVENTORY_ADJUSTMENT",
  "PROCUREMENT_SUBMIT",
  "SETTINGS_CHANGE",
  "CUSTODY_OVERRIDE",
  "RECONCILIATION_CORRECTION",
]);

export async function POST(request: Request) {
  const gate = await adminGate();
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const action = (body.action ?? "").trim();
  const reason = (body.reason ?? "").trim();

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  if (action === "create") {
    const kind = (body.kind ?? "").trim();
    if (!KINDS.has(kind) || reason.length < 8) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
    }
    const { data, error } = await db
      .from("admin_approval_requests")
      .insert({
        kind,
        payload: {
          userId: body.userId ?? null,
          asset: body.asset ?? null,
          amount: body.amount ?? null,
          direction: body.direction ?? null,
          evidence: body.evidence ?? null,
        },
        status: "PENDING_APPROVAL",
        maker_id: gate.ctx.userId,
        reason,
      })
      .select("id")
      .maybeSingle();
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: "approval.create",
      entity: "approval_request",
      entityId: data?.id ?? null,
      reason,
      result: error ? "error" : "ok",
      meta: { kind },
    });
    if (error) {
      return NextResponse.json(
        { ok: false, error: "جدول تأیید دو مرحله‌ای NOT READY است." },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true, message: "درخواست در صف تأیید قرار گرفت." });
  }

  const id = (body.id ?? "").trim();
  if (!id || reason.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const { data: row } = await db.from("admin_approval_requests").select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (action === "approve") {
    if (row.maker_id === gate.ctx.userId) {
      return NextResponse.json(
        { ok: false, error: "سازنده نمی‌تواند درخواست خودش را تأیید کند." },
        { status: 403 }
      );
    }
    const { error } = await db
      .from("admin_approval_requests")
      .update({
        status: "APPROVED",
        checker_id: gate.ctx.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "PENDING_APPROVAL");
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: "approval.approve",
      entity: "approval_request",
      entityId: id,
      reason,
      result: error ? "error" : "ok",
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: "تأیید شد. اجرا جداگانه است." });
  }

  if (action === "reject") {
    await db
      .from("admin_approval_requests")
      .update({ status: "REJECTED", checker_id: gate.ctx.userId, updated_at: new Date().toISOString() })
      .eq("id", id);
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: "approval.reject",
      entity: "approval_request",
      entityId: id,
      reason,
      result: "ok",
    });
    return NextResponse.json({ ok: true, message: "رد شد." });
  }

  if (action === "execute") {
    if (row.status !== "APPROVED") {
      return NextResponse.json({ ok: false, error: "فقط درخواست APPROVED قابل اجراست." }, { status: 400 });
    }
    if (row.kind === "FINANCIAL_ADJUSTMENT") {
      await writeAudit({
        actorId: gate.ctx.userId,
        role: gate.ctx.role,
        action: "approval.execute_blocked",
        entity: "approval_request",
        entityId: id,
        reason,
        result: "denied",
        meta: {
          note: "Ledger journal posting is NOT READY on this database. wallets.balance is never mutated.",
        },
      });
      return NextResponse.json(
        {
          ok: false,
          error:
            "اجرای اصلاح مالی نیازمند posting ژورنال است. دفترکل عملیاتی روی این دیتابیس NOT READY است. موجودی مستقیم تغییر نمی‌کند.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "اجرای این نوع درخواست هنوز پیاده نشده (NOT READY)." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
