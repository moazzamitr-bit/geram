import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { hasPermission, type AdminRole } from "@/lib/admin/rbac";
import {
  approvalRequiresDistinctChecker,
  parseIdempotencyKey,
  parseStoredWalletCredit,
  parseTomanAmount,
  resolveCreditTarget,
  walletCreditIdempotentAction,
} from "@/lib/admin/wallet-credit";
import { PRODUCTION_ASSETS, type AssetCode } from "@/lib/core/assets";
import { gramsToUg, tomanToIrr } from "@/lib/core/money";
import { getFinancialCore } from "@/lib/core/runtime";
import { CoreError } from "@/lib/core/types";
import { createServiceClient } from "@/lib/supabase/admin";

const KINDS = new Set([
  "FINANCIAL_ADJUSTMENT",
  "INVENTORY_ADJUSTMENT",
  "PROCUREMENT_SUBMIT",
  "SETTINGS_CHANGE",
  "CUSTODY_OVERRIDE",
  "RECONCILIATION_CORRECTION",
]);

type ServiceDb = ReturnType<typeof createServiceClient>;

export async function POST(request: Request) {
  const gate = await adminGate();
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const action = (body.action ?? "").trim();
  const reason = (body.reason ?? "").trim();

  let db: ServiceDb;
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
    if (kind === "FINANCIAL_ADJUSTMENT") {
      return createWalletCredit(db, gate.ctx, body, reason);
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

  if (
    row.kind === "FINANCIAL_ADJUSTMENT" &&
    (action === "approve" || action === "execute") &&
    !hasPermission(gate.ctx.role, "treasury.write")
  ) {
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: "permission.denied",
      entity: "approval_request",
      entityId: id,
      reason,
      result: "denied",
      meta: { kind: row.kind, action },
    });
    return NextResponse.json({ ok: false, error: "permission denied" }, { status: 403 });
  }

  if (action === "approve") {
    if (
      row.maker_id === gate.ctx.userId &&
      approvalRequiresDistinctChecker(String(row.kind))
    ) {
      return NextResponse.json(
        { ok: false, error: "سازنده نمی‌تواند درخواست خودش را تأیید کند." },
        { status: 403 }
      );
    }
    const { data: approved, error } = await db
      .from("admin_approval_requests")
      .update({
        status: "APPROVED",
        checker_id: gate.ctx.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "PENDING_APPROVAL")
      .select("*")
      .maybeSingle();
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: "approval.approve",
      entity: "approval_request",
      entityId: id,
      reason,
      result: error ? "error" : approved ? "ok" : "error",
      meta: { kind: row.kind, singleAdmin: row.kind === "FINANCIAL_ADJUSTMENT" },
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!approved) {
      return NextResponse.json(
        { ok: false, error: "فقط درخواست در انتظار تأیید قابل تأیید است." },
        { status: 409 }
      );
    }
    if (row.kind === "FINANCIAL_ADJUSTMENT") {
      return executeWalletCredit({
        db,
        row: approved as Record<string, unknown>,
        reason,
        ctx: gate.ctx,
      });
    }
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
      return executeWalletCredit({ db, row, reason, ctx: gate.ctx });
    }
    return NextResponse.json(
      { ok: false, error: "اجرای این نوع درخواست هنوز پیاده نشده (NOT READY)." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}

async function createWalletCredit(
  db: ServiceDb,
  ctx: { userId: string; role: AdminRole },
  body: Record<string, string>,
  reason: string
) {
  if (!hasPermission(ctx.role, "treasury.write")) {
    await writeAudit({
      actorId: ctx.userId,
      role: ctx.role,
      action: "permission.denied",
      entity: "approval_request",
      reason,
      result: "denied",
      meta: { kind: "FINANCIAL_ADJUSTMENT" },
    });
    return NextResponse.json({ ok: false, error: "permission denied" }, { status: 403 });
  }

  const idempotencyKey = parseIdempotencyKey(body.idempotencyKey);
  const amount = parseTomanAmount(body.amount ?? "");
  if (!idempotencyKey) {
    return NextResponse.json({ ok: false, error: "idempotency_key_required" }, { status: 400 });
  }
  if (!amount) {
    return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }

  const target = await resolveCreditTarget({
    userId: body.userId,
    phone: body.phone,
    lookupById: async (id) => {
      const { data } = await db.from("profiles").select("id, phone").eq("id", id).maybeSingle();
      return data ? { id: data.id as string, phone: (data.phone as string | null) ?? null } : null;
    },
    lookupByPhones: async (phones) => {
      const { data } = await db.from("profiles").select("id, phone").in("phone", phones).limit(5);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        phone: (row.phone as string | null) ?? null,
      }));
    },
  });
  if (!target.ok) {
    return NextResponse.json({ ok: false, error: target.error }, { status: target.status });
  }

  const { data: existing, error: lookupError } = await db
    .from("admin_approval_requests")
    .select("id, status, payload")
    .eq("kind", "FINANCIAL_ADJUSTMENT")
    .contains("payload", { idempotencyKey })
    .limit(1);
  if (lookupError) {
    return NextResponse.json(
      { ok: false, error: "جدول تأیید دو مرحله‌ای NOT READY است." },
      { status: 503 }
    );
  }
  const prior = existing?.[0] as { id?: string; status?: string; payload?: unknown } | undefined;
  if (prior?.id) {
    const stored = parseStoredWalletCredit(prior.payload);
    const same =
      stored.ok &&
      stored.userId === target.userId &&
      stored.amountToman === amount.toman &&
      stored.idempotencyKey === idempotencyKey;
    if (!same) {
      return NextResponse.json(
        { ok: false, error: "idempotency_conflict" },
        { status: 409 }
      );
    }
    const follow = walletCreditIdempotentAction(String(prior.status ?? ""));
    if (follow === "replay") {
      return NextResponse.json({
        ok: true,
        replayed: true,
        id: prior.id,
        message: "این شارژ قبلاً در دفترکل ثبت شده است.",
      });
    }
    if (follow === "conflict") {
      return NextResponse.json({ ok: false, error: "idempotency_conflict" }, { status: 409 });
    }
    const ready = await promoteWalletCreditForPost(db, String(prior.id), String(prior.status ?? ""), ctx.userId);
    if (!ready) {
      return NextResponse.json({ ok: false, error: "این درخواست قابل اعمال نیست." }, { status: 409 });
    }
    return executeWalletCredit({ db, row: ready, reason, ctx });
  }

  const payload = {
    userId: target.userId,
    phone: target.phone,
    amount: String(amount.toman),
    asset: "IRR",
    direction: "CREDIT",
    idempotencyKey,
    singleAdmin: true,
  };

  const { data, error } = await db
    .from("admin_approval_requests")
    .insert({
      kind: "FINANCIAL_ADJUSTMENT",
      payload,
      status: "APPROVED",
      maker_id: ctx.userId,
      checker_id: ctx.userId,
      reason,
    })
    .select("*")
    .maybeSingle();
  await writeAudit({
    actorId: ctx.userId,
    role: ctx.role,
    action: "approval.create",
    entity: "approval_request",
    entityId: data?.id ?? null,
    reason,
    result: error ? "error" : "ok",
    meta: {
      kind: "FINANCIAL_ADJUSTMENT",
      userId: target.userId,
      amountToman: amount.toman,
      idempotencyKey,
      singleAdmin: true,
    },
  });
  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "جدول تأیید دو مرحله‌ای NOT READY است." },
      { status: 503 }
    );
  }
  return executeWalletCredit({ db, row: data as Record<string, unknown>, reason, ctx });
}

/** Move a leftover wallet-credit row to APPROVED so the same admin can post it. */
async function promoteWalletCreditForPost(
  db: ServiceDb,
  id: string,
  status: string,
  checkerId: string
): Promise<Record<string, unknown> | null> {
  if (status === "APPROVED") {
    const { data } = await db.from("admin_approval_requests").select("*").eq("id", id).maybeSingle();
    return (data as Record<string, unknown> | null) ?? null;
  }
  if (status !== "PENDING_APPROVAL" && status !== "DRAFT") return null;
  const { data } = await db
    .from("admin_approval_requests")
    .update({
      status: "APPROVED",
      checker_id: checkerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", status)
    .select("*")
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * Posts APPROVED_OPENING_BALANCE to USER_AVAILABLE IRR.
 * Claim APPROVED → EXECUTED before the journal so a double click cannot post twice.
 * The ledger ref id is the idempotency key. The wallets table is never updated.
 * Closed beta: the same admin may be both maker and checker.
 */
async function executeWalletCredit(input: {
  db: ServiceDb;
  row: Record<string, unknown>;
  reason: string;
  ctx: { userId: string; role: AdminRole };
}) {
  const { db, row, reason, ctx } = input;
  const id = String(row.id);
  const parsed = parseStoredWalletCredit(row.payload);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("id", parsed.userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
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
    const posted = await core.creditApprovedUserIrr({
      userId: parsed.userId,
      amountIrr: parsed.amountIrr,
      reason,
      refId: parsed.refId,
    });
    await writeAudit({
      actorId: ctx.userId,
      role: ctx.role,
      action: "approval.execute",
      entity: "approval_request",
      entityId: id,
      reason,
      result: "ok",
      meta: {
        kind: "FINANCIAL_ADJUSTMENT",
        userId: parsed.userId,
        amountToman: parsed.amountToman,
        amountIrr: parsed.amountIrr.toString(),
        journalId: posted.journalId,
        replayed: posted.replayed,
        refType: "APPROVED_OPENING_BALANCE",
        accountCode: "USER_AVAILABLE",
        singleAdmin: true,
        note: "Single-admin ledger credit. wallets table was not mutated.",
      },
    });
    return NextResponse.json({
      ok: true,
      journalId: posted.journalId,
      replayed: posted.replayed,
      message: posted.replayed
        ? `این شارژ قبلاً در دفترکل بود (${posted.journalId}).`
        : `شارژ اعمال شد و در دفترکل ثبت شد (${posted.journalId}).`,
    });
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
      meta: { error: err instanceof CoreError ? err.code : "post_failed" },
    });
    if (err instanceof CoreError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json(
      { ok: false, error: "ثبت در دفترکل ناموفق بود. اتصال دیتابیس معاملات را بررسی کنید." },
      { status: 500 }
    );
  }
}

/**
 * Posts an approved opening balance to the ledger: physical metal the platform
 * really holds (PLATFORM_AVAILABLE) or operating cash (PLATFORM_CASH_CONTROL),
 * against PLATFORM_OPENING. Without this, inventory is 0 and every buy fails.
 * The request is claimed (APPROVED → EXECUTED) before posting so a double
 * click cannot post twice; the journal refId is the approval id.
 */
async function executeOpeningInventory(input: {
  db: ServiceDb;
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
