import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Admin actions on a verified bank card (user_bank_cards). Ownership and IBAN
 * come only from Finnotech, so the only manual action is disabling a card;
 * a disabled card can no longer receive withdrawals.
 */
export async function POST(request: Request) {
  const gate = await adminGate("bank.view");
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const cardId = (body.accountId ?? body.cardId ?? "").trim();
  const action = (body.action ?? "").trim();
  const reason = (body.reason ?? "").trim();
  if (!cardId || reason.length < 8 || action !== "disable") {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }
  const { error } = await db.from("user_bank_cards").update({ status: "DISABLED" }).eq("id", cardId);
  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: "bank.disable",
    entity: "user_bank_card",
    entityId: cardId,
    reason,
    result: error ? "error" : "ok",
  });
  if (error) return NextResponse.json({ ok: false, error: "update_failed" }, { status: 503 });
  return NextResponse.json({ ok: true, message: "کارت غیرفعال شد و دیگر مقصد برداشت نیست." });
}
