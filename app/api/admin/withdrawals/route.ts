import { NextResponse } from "next/server";
import { adminGate } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { jsonError } from "@/lib/core/http";
import { transitionWithdrawal } from "@/lib/withdraw/service";

export const dynamic = "force-dynamic";

const MESSAGES = {
  pay: "واریز ثبت شد و مبلغ از دفترکل خارج شد.",
  reject: "درخواست رد شد و مبلغ به کیف پول کاربر برگشت.",
} as const;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  if (action !== "pay" && action !== "reject") {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }
  const gate = await adminGate("treasury.write");
  if (!gate.ok) return gate.response;
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  const payoutRef = String(body.payoutRef ?? "").trim();
  const note = String(body.note ?? "").trim();
  try {
    const row = await transitionWithdrawal({ id, action, actorId: gate.ctx.userId, payoutRef, note });
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: `withdrawal.${action}`,
      entity: "toman_withdrawal",
      entityId: id,
      reason: action === "pay" ? `payout_ref ${payoutRef}${note ? ` — ${note}` : ""}` : note,
    });
    return NextResponse.json({ ok: true, request: row, message: MESSAGES[action] });
  } catch (err) {
    return jsonError(err);
  }
}
