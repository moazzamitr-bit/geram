import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { hasPermission, type AdminRole } from "@/lib/admin/rbac";
import { planImmediateInventoryOpening } from "@/lib/admin/inventory-opening";
import {
  parseIdempotencyKey,
  parseStoredWalletCredit,
  parseTomanAmount,
  parseWalletDirection,
  planImmediateWalletCredit,
  resolveCreditTarget,
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
    if (kind === "INVENTORY_ADJUSTMENT") {
      return createInventoryOpening(db, gate.ctx, body, reason);
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
        { ok: false, error: "جدول درخواست‌ها NOT READY است." },
        { status: 503 }
      );
    }
    return NextResponse.json({
      ok: true,
      message: "درخواست ثبت شد. همان ادمین می‌تواند همین حالا آن را تأیید کند.",
    });
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
    return NextResponse.json({
      ok: true,
      message: "تأیید شد. همان ادمین می‌تواند اجرا را هم ثبت کند.",
    });
  }

  if (action === "reject") {
    if (row.kind === "FINANCIAL_ADJUSTMENT" && row.status === "EXECUTED") {
      return NextResponse.json(
        { ok: false, error: "شارژ ثبت‌شده در دفترکل را نمی‌توان رد کرد." },
        { status: 400 }
      );
    }
    if (row.kind === "INVENTORY_ADJUSTMENT" && row.status === "EXECUTED") {
      return NextResponse.json(
        { ok: false, error: "موجودی ثبت‌شده در دفترکل را نمی‌توان رد کرد." },
        { status: 400 }
      );
    }
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
    if (row.kind === "FINANCIAL_ADJUSTMENT") {
      return executeWalletCredit({ db, row, reason, ctx: gate.ctx });
    }
    if (row.status !== "APPROVED") {
      return NextResponse.json({ ok: false, error: "فقط درخواست APPROVED قابل اجراست." }, { status: 400 });
    }
    if (row.kind === "INVENTORY_ADJUSTMENT") {
      return executeOpeningInventory({ db, row, reason, ctx: gate.ctx });
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
      { ok: false, error: "جدول ثبت شارژ NOT READY است." },
      { status: 503 }
    );
  }
  const direction = parseWalletDirection(body.direction);
  if (!direction) {
    return NextResponse.json({ ok: false, error: "invalid_direction" }, { status: 400 });
  }

  const prior = existing?.[0];
  const plan = planImmediateWalletCredit({
    userId: target.userId,
    amountToman: amount.toman,
    idempotencyKey,
    direction,
    prior: prior
      ? { id: String(prior.id), status: String(prior.status), payload: prior.payload }
      : null,
  });
  if (!plan.ok) {
    const error =
      plan.error === "credit_rejected"
        ? "این کلید شارژ قبلاً رد شده است. صفحه را تازه کنید و دوباره ثبت کنید."
        : plan.error;
    return NextResponse.json({ ok: false, error }, { status: plan.status });
  }

  const payload = {
    userId: target.userId,
    phone: target.phone,
    amount: String(amount.toman),
    asset: "IRR",
    direction,
    idempotencyKey,
  };

  let posted: { journalId: string; replayed: boolean };
  try {
    const core = getFinancialCore();
    const postInput = {
      userId: target.userId,
      amountIrr: plan.amountIrr,
      reason,
      refId: plan.refId,
    };
    posted =
      direction === "DEBIT"
        ? await core.debitApprovedUserIrr(postInput)
        : await core.creditApprovedUserIrr(postInput);
  } catch (err) {
    await writeAudit({
      actorId: ctx.userId,
      role: ctx.role,
      action: direction === "DEBIT" ? "wallet.debit" : "wallet.credit",
      entity: "ledger_journal",
      entityId: plan.priorId,
      reason,
      result: "error",
      meta: {
        kind: "FINANCIAL_ADJUSTMENT",
        userId: target.userId,
      direction,
      amountToman: amount.toman,
      idempotencyKey,
      error: err instanceof CoreError ? err.code : "post_failed",
    },
  });
  if (err instanceof CoreError) {
    return NextResponse.json(
      { ok: false, error: err.code === "insufficient_funds" ? err.message : err.code },
      { status: err.httpStatus }
    );
  }
    return NextResponse.json(
      { ok: false, error: "ثبت در دفترکل ناموفق بود. اتصال دیتابیس معاملات را بررسی کنید." },
      { status: 500 }
    );
  }

  let recordId = plan.priorId;
  let recordError: string | null = null;
  if (plan.record === "insert") {
    const { data, error } = await db
      .from("admin_approval_requests")
      .insert({
        kind: "FINANCIAL_ADJUSTMENT",
        payload,
        status: "EXECUTED",
        maker_id: ctx.userId,
        reason,
      })
      .select("id")
      .maybeSingle();
    recordId = data?.id ? String(data.id) : null;
    recordError = error?.message ?? null;
  } else if (plan.record === "mark_executed" && plan.priorId) {
    const { error } = await db
      .from("admin_approval_requests")
      .update({ status: "EXECUTED", updated_at: new Date().toISOString() })
      .eq("id", plan.priorId)
      .in("status", ["PENDING_APPROVAL", "APPROVED", "DRAFT"]);
    recordError = error?.message ?? null;
  }

  await writeAudit({
    actorId: ctx.userId,
    role: ctx.role,
    action: direction === "DEBIT" ? "wallet.debit" : "wallet.credit",
    entity: "ledger_journal",
    entityId: posted.journalId,
    reason,
    result: "ok",
    meta: {
      kind: "FINANCIAL_ADJUSTMENT",
      direction,
      userId: target.userId,
      amountToman: amount.toman,
      amountIrr: plan.amountIrr.toString(),
      idempotencyKey,
      journalId: posted.journalId,
      replayed: posted.replayed,
      refType: "APPROVED_OPENING_BALANCE",
      accountCode: "USER_AVAILABLE",
      approvalId: recordId,
      recordError,
      note:
        direction === "DEBIT"
          ? "One admin posted a balanced debit. Balance cannot go negative."
          : "One admin posted the opening credit.",
    },
  });

  return NextResponse.json({
    ok: true,
    id: recordId,
    journalId: posted.journalId,
    replayed: posted.replayed,
    message: posted.replayed
      ? "این درخواست قبلاً در دفترکل ثبت شده و دوباره اعمال نشد."
      : direction === "DEBIT"
        ? `برگشت شارژ در دفترکل ثبت شد (${posted.journalId}).`
        : `شارژ در دفترکل ثبت شد (${posted.journalId}).`,
  });
}

/**
 * Posts APPROVED_OPENING_BALANCE to USER_AVAILABLE IRR.
 * New credits post on create. This path finishes a row still waiting in the queue,
 * including one the same admin created. Claim the open status before the journal
 * so a double click cannot post twice. The wallets table is never updated.
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

  const previous = String(row.status);
  if (previous !== "PENDING_APPROVAL" && previous !== "APPROVED") {
    return NextResponse.json({ ok: false, error: "فقط درخواست باز شارژ قابل اجراست." }, { status: 400 });
  }

  const { data: claimed } = await db
    .from("admin_approval_requests")
    .update({ status: "EXECUTED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", previous)
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ ok: false, error: "این درخواست قبلاً اجرا شده است." }, { status: 409 });
  }

  try {
    const core = getFinancialCore();
    const postInput = {
      userId: parsed.userId,
      amountIrr: parsed.amountIrr,
      reason,
      refId: parsed.refId,
    };
    const posted =
      parsed.direction === "DEBIT"
        ? await core.debitApprovedUserIrr(postInput)
        : await core.creditApprovedUserIrr(postInput);
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
        direction: parsed.direction,
        amountToman: parsed.amountToman,
        amountIrr: parsed.amountIrr.toString(),
        journalId: posted.journalId,
        replayed: posted.replayed,
        refType: "APPROVED_OPENING_BALANCE",
        accountCode: "USER_AVAILABLE",
        note:
          parsed.direction === "DEBIT"
            ? "Ledger debit. Available balance was checked first."
            : "Ledger opening credit.",
      },
    });
    return NextResponse.json({
      ok: true,
      journalId: posted.journalId,
      replayed: posted.replayed,
      message: `در دفترکل ثبت شد (${posted.journalId}).`,
    });
  } catch (err) {
    await db
      .from("admin_approval_requests")
      .update({ status: previous, updated_at: new Date().toISOString() })
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
 * Posts opening metal or operating cash on the submitting admin's request.
 * Same idempotency key posts one APPROVED_OPENING_BALANCE journal.
 * The wallets table is never updated.
 */
async function createInventoryOpening(
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
      meta: { kind: "INVENTORY_ADJUSTMENT" },
    });
    return NextResponse.json({ ok: false, error: "permission denied" }, { status: 403 });
  }

  const idempotencyKey = parseIdempotencyKey(body.idempotencyKey);
  if (!idempotencyKey) {
    return NextResponse.json({ ok: false, error: "idempotency_key_required" }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await db
    .from("admin_approval_requests")
    .select("id, status, payload")
    .eq("kind", "INVENTORY_ADJUSTMENT")
    .contains("payload", { idempotencyKey })
    .limit(1);
  if (lookupError) {
    return NextResponse.json(
      { ok: false, error: "جدول ثبت موجودی NOT READY است." },
      { status: 503 }
    );
  }
  const prior = existing?.[0];
  const plan = planImmediateInventoryOpening({
    asset: body.asset ?? "",
    amount: body.amount ?? "",
    direction: body.direction,
    idempotencyKey,
    prior: prior
      ? { id: String(prior.id), status: String(prior.status), payload: prior.payload }
      : null,
  });
  if (!plan.ok) {
    const error =
      plan.error === "opening_rejected"
        ? "این کلید موجودی قبلاً رد شده است. صفحه را تازه کنید و دوباره ثبت کنید."
        : plan.error === "idempotency_conflict"
          ? "این کلید قبلاً برای موجودی دیگری استفاده شده. صفحه را تازه کنید و دوباره ثبت کنید."
          : plan.error === "invalid_amount"
            ? "مقدار نامعتبر است. فلز را به گرم و نقد را به تومانِ بدون اعشار وارد کنید."
            : plan.error === "only_increase"
              ? "فقط افزایش موجودی اولیه ثبت می‌شود."
              : plan.error;
    return NextResponse.json({ ok: false, error }, { status: plan.status });
  }

  const payload = {
    asset: plan.asset,
    amount: plan.amountLabel,
    direction: "IN",
    evidence: body.evidence ?? null,
    idempotencyKey,
    ledgerAmount: plan.ledgerAmount.toString(),
    accountCode: plan.accountCode,
  };

  let posted: { journalId: string; replayed: boolean };
  try {
    const core = getFinancialCore();
    posted = await core.postApprovedPlatformOpening({
      accountCode: plan.accountCode,
      asset: plan.ledgerAsset,
      amount: plan.ledgerAmount,
      reason,
      refId: plan.refId,
    });
  } catch (err) {
    await writeAudit({
      actorId: ctx.userId,
      role: ctx.role,
      action: "inventory.opening",
      entity: "ledger_journal",
      entityId: plan.priorId,
      reason,
      result: "error",
      meta: {
        kind: "INVENTORY_ADJUSTMENT",
        asset: plan.asset,
        amount: plan.amountLabel,
        idempotencyKey,
        error: err instanceof CoreError ? err.code : "post_failed",
      },
    });
    if (err instanceof CoreError) {
      return NextResponse.json({ ok: false, error: err.code }, { status: err.httpStatus });
    }
    return NextResponse.json(
      { ok: false, error: "ثبت در دفترکل ناموفق بود. اتصال دیتابیس معاملات را بررسی کنید." },
      { status: 500 }
    );
  }

  let recordId = plan.priorId;
  let recordError: string | null = null;
  if (plan.record === "insert") {
    const { data, error } = await db
      .from("admin_approval_requests")
      .insert({
        kind: "INVENTORY_ADJUSTMENT",
        payload,
        status: "EXECUTED",
        maker_id: ctx.userId,
        reason,
      })
      .select("id")
      .maybeSingle();
    recordId = data?.id ? String(data.id) : null;
    recordError = error?.message ?? null;
  } else if (plan.record === "mark_executed" && plan.priorId) {
    const { error } = await db
      .from("admin_approval_requests")
      .update({ status: "EXECUTED", updated_at: new Date().toISOString() })
      .eq("id", plan.priorId)
      .in("status", ["PENDING_APPROVAL", "APPROVED", "DRAFT"]);
    recordError = error?.message ?? null;
  }

  await writeAudit({
    actorId: ctx.userId,
    role: ctx.role,
    action: "inventory.opening",
    entity: "ledger_journal",
    entityId: posted.journalId,
    reason,
    result: "ok",
    meta: {
      kind: "INVENTORY_ADJUSTMENT",
      asset: plan.asset,
      amount: plan.amountLabel,
      ledgerAmount: plan.ledgerAmount.toString(),
      accountCode: plan.accountCode,
      idempotencyKey,
      journalId: posted.journalId,
      replayed: posted.replayed,
      refType: "APPROVED_OPENING_BALANCE",
      approvalId: recordId,
      recordError,
      note: "One admin posted the opening inventory. wallets table was not mutated.",
    },
  });

  return NextResponse.json({
    ok: true,
    id: recordId,
    journalId: posted.journalId,
    replayed: posted.replayed,
    message: posted.replayed
      ? "این موجودی قبلاً در دفترکل ثبت شده و دوباره اعمال نشد."
      : `موجودی در دفترکل ثبت شد (${posted.journalId}).`,
  });
}

/**
 * Posts an opening balance still waiting in the queue. The same admin who
 * created the row can execute it. Claim the open status before posting so a
 * double click cannot post twice; the journal refId is the approval id.
 */
async function executeOpeningInventory(input: {
  db: ServiceDb;
  row: Record<string, unknown>;
  reason: string;
  ctx: { userId: string; role: AdminRole };
}) {
  const { db, row, reason, ctx } = input;
  const id = String(row.id);
  if (!hasPermission(ctx.role, "treasury.write")) {
    await writeAudit({
      actorId: ctx.userId,
      role: ctx.role,
      action: "permission.denied",
      entity: "approval_request",
      entityId: id,
      reason,
      result: "denied",
      meta: { kind: "INVENTORY_ADJUSTMENT", action: "execute" },
    });
    return NextResponse.json({ ok: false, error: "permission denied" }, { status: 403 });
  }

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

  const previous = String(row.status);
  if (previous !== "PENDING_APPROVAL" && previous !== "APPROVED") {
    return NextResponse.json({ ok: false, error: "فقط درخواست باز موجودی قابل اجراست." }, { status: 400 });
  }

  const { data: claimed } = await db
    .from("admin_approval_requests")
    .update({ status: "EXECUTED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", previous)
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ ok: false, error: "این درخواست قبلاً اجرا شده است." }, { status: 409 });
  }

  try {
    const core = getFinancialCore();
    const posted = await core.postApprovedPlatformOpening({
      accountCode: isCash ? "PLATFORM_CASH_CONTROL" : "PLATFORM_AVAILABLE",
      asset: isCash ? "IRR" : (asset as AssetCode),
      // Metal is entered in grams, cash in toman.
      amount: isCash ? tomanToIrr(Math.floor(amount)) : gramsToUg(amount),
      reason,
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
      meta: {
        kind: "INVENTORY_ADJUSTMENT",
        asset,
        amount,
        journalId: posted.journalId,
        replayed: posted.replayed,
        refType: "APPROVED_OPENING_BALANCE",
        note: "One admin posted the opening inventory. wallets table was not mutated.",
      },
    });
    return NextResponse.json({
      ok: true,
      journalId: posted.journalId,
      replayed: posted.replayed,
      message: `در دفترکل ثبت شد (${posted.journalId}).`,
    });
  } catch (err) {
    await db
      .from("admin_approval_requests")
      .update({ status: previous, updated_at: new Date().toISOString() })
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
      return NextResponse.json({ ok: false, error: err.code }, { status: err.httpStatus });
    }
    return NextResponse.json(
      { ok: false, error: "ثبت در دفترکل ناموفق بود. اتصال دیتابیس معاملات را بررسی کنید." },
      { status: 500 }
    );
  }
}
