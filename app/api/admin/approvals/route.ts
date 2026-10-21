import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";
import type { AdminRole } from "@/lib/admin/rbac";
import { PRODUCTION_ASSETS, type AssetCode } from "@/lib/core/assets";
import { gramsToUg, tomanToIrr } from "@/lib/core/money";
import { getFinancialCore } from "@/lib/core/runtime";

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
    if (row.kind === "INVENTORY_ADJUSTMENT") {
      return executeOpeningInventory({ db, row, reason, ctx: gate.ctx });
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

/**
 * Posts an approved opening balance to the ledger: physical metal the platform
 * really holds (PLATFORM_AVAILABLE) or operating cash (PLATFORM_CASH_CONTROL),
 * against PLATFORM_OPENING. Without this, inventory is 0 and every buy fails.
 * The request is claimed (APPROVED → EXECUTED) before posting so a double
 * click cannot post twice; the journal refId is the approval id.
 */
async function executeOpeningInventory(input: {
  db: ReturnType<typeof createServiceClient>;
  row: Record<string, unknown>;
  reason: string;
  ctx: { userId: string; role: AdminRole };
}) {
  const { db, row, reason, ctx } = input;
  const id = String(row.id);
  const payload = (row.payload ?? {}) as { asset?: string; amount?: string; direction?: string };
  const asset = String(payload.asset ?? "");
  const amount = Number(payload.amount ?? 0);

  const isCash = asset === "IRR";
  if ((!isCash && !PRODUCTION_ASSETS.includes(asset as AssetCode)) || !(amount > 0)) {
    return NextResponse.json({ ok: false, error: "دارایی یا مقدار نامعتبر است." }, { status: 400 });
  }
  if (payload.direction && payload.direction !== "IN") {
    return NextResponse.json(
      { ok: false, error: "فقط افزایش موجودی اولیه پشتیبانی می‌شود." },
      { status: 400 }
    );
  }

  const { data: claimed } = await db
    .from("admin_approval_requests")
    .update({ status: "EXECUTED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "APPROVED")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ ok: false, error: "این درخواست قبلاً اجرا شده است." }, { status: 409 });
  }

  try {
    const core = getFinancialCore();
    const journalId = await core.postOpening({
      accountCode: isCash ? "PLATFORM_CASH_CONTROL" : "PLATFORM_AVAILABLE",
      asset: isCash ? "IRR" : (asset as AssetCode),
      // Metal is entered in grams, cash in toman.
      amount: isCash ? tomanToIrr(Math.floor(amount)) : gramsToUg(amount),
      refType: "APPROVED_OPENING_BALANCE",
      reason: "APPROVED_OPENING",
      refId: `approval:${id}`,
    });
    await writeAudit({
      actorId: ctx.userId,
      role: ctx.role,
      action: "approval.execute",
      entity: "approval_request",
      entityId: id,
      reason,
      result: "ok",
      meta: { kind: "INVENTORY_ADJUSTMENT", asset, amount, journalId },
    });
    return NextResponse.json({ ok: true, message: `در دفترکل ثبت شد (${journalId}).` });
  } catch (err) {
    await db
      .from("admin_approval_requests")
      .update({ status: "APPROVED", updated_at: new Date().toISOString() })
      .eq("id", id);
    await writeAudit({
      actorId: ctx.userId,
      role: ctx.role,
      action: "approval.execute",
      entity: "approval_request",
      entityId: id,
      reason,
      result: "error",
      meta: { error: err instanceof Error ? err.message : "post_failed" },
    });
    return NextResponse.json(
      { ok: false, error: "ثبت در دفترکل ناموفق بود. اتصال دیتابیس معاملات را بررسی کنید." },
      { status: 500 }
    );
  }
}
