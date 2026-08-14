import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const gate = await adminGate("support.reply");
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const ticketId = (body.ticketId ?? "").trim();
  const text = (body.body ?? body.reason ?? "").trim();
  const status = (body.status ?? "").trim();
  const internal = body.internal === "1" || body.internal === "true";
  const reason = (body.reason ?? "support reply").trim();

  if (!ticketId || text.length < 1) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  if (internal) {
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: "support.internal_note",
      entity: "support_ticket",
      entityId: ticketId,
      reason: text,
      result: "ok",
      meta: { visibleToUser: false },
    });
    return NextResponse.json({ ok: true, message: "یادداشت داخلی فقط در audit ثبت شد." });
  }

  const { error } = await db.from("support_messages").insert({
    ticket_id: ticketId,
    sender: "support",
    body: text,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (status) {
    await db.from("support_tickets").update({ status }).eq("id", ticketId);
  }
  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: "support.reply",
    entity: "support_ticket",
    entityId: ticketId,
    reason,
    result: "ok",
    meta: { status: status || null },
  });

  return NextResponse.json({ ok: true, message: "پاسخ برای کاربر ارسال شد." });
}
