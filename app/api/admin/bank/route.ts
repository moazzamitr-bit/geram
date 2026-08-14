import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const gate = await adminGate("bank.view");
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const accountId = (body.accountId ?? "").trim();
  const action = (body.action ?? "").trim();
  const reason = (body.reason ?? "").trim();
  if (!accountId || reason.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  if (action === "mark_verified") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "تأیید دستی IBAN بدون maker-checker ممنوع است. مجوز bank.mark_verified صادر نشده.",
      },
      { status: 403 }
    );
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  if (action === "disable") {
    const { error } = await db
      .from("bank_accounts")
      .update({ account_status: "DISABLED" })
      .eq("id", accountId);
    if (error) {
      await writeAudit({
        actorId: gate.ctx.userId,
        role: gate.ctx.role,
        action: "bank.disable",
        entity: "bank_account",
        entityId: accountId,
        reason,
        result: "error",
        meta: { error: error.message, note: "account_status column may be missing" },
      });
      return NextResponse.json(
        { ok: false, error: "ستون account_status هنوز اعمال نشده. اقدام در audit ثبت شد." },
        { status: 503 }
      );
    }
  }

  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: `bank.${action}`,
    entity: "bank_account",
    entityId: accountId,
    reason,
    result: "ok",
    meta: {
      note:
        action === "retry"
          ? "Bank verification provider is MOCK/NOT READY — retry logged only."
          : action === "resubmission"
            ? "User resubmission requested (audit only until product workflow exists)."
            : null,
    },
  });

  return NextResponse.json({
    ok: true,
    message:
      action === "retry"
        ? "ثبت شد. ارائه‌دهنده مالکیت حساب MOCK است — فراخوان خارجی نیست."
        : "ثبت شد.",
  });
}
