import { NextResponse } from "next/server";
import { adminGate } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";
import { maskEmail, maskIban, maskPhone } from "@/lib/admin/mask";

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: Request) {
  const gate = await adminGate("export.run");
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "";
  const allowed = new Set([
    "users",
    "kyc",
    "trades",
    "deposits",
    "withdrawals",
    "reconciliation",
    "treasury",
  ]);
  if (!allowed.has(type)) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  let headers: string[] = [];
  let rows: Record<string, unknown>[] = [];

  if (type === "users" || type === "kyc") {
    const { data } = await db
      .from("profiles")
      .select("id, first_name, last_name, phone, email, kyc_status, role, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    headers = ["id", "name", "phone", "email", "kyc_status", "role", "created_at"];
    rows = (data ?? []).map((p) => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" "),
      phone: maskPhone(p.phone),
      email: maskEmail(p.email),
      kyc_status: p.kyc_status,
      role: p.role,
      created_at: p.created_at,
    }));
  } else if (type === "trades" || type === "deposits" || type === "withdrawals") {
    let q = db
      .from("transactions")
      .select("id, tracking_code, type, status, amount_toman, gold_mg, instrument, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (type === "trades") q = q.in("type", ["خرید", "فروش"]);
    if (type === "deposits") q = q.eq("type", "واریز");
    if (type === "withdrawals") q = q.eq("type", "برداشت");
    const { data } = await q;
    headers = ["id", "tracking_code", "type", "status", "amount_toman", "gold_mg", "instrument", "created_at"];
    rows = (data ?? []) as Record<string, unknown>[];
  } else if (type === "reconciliation") {
    const { data, error } = await db.from("admin_reconciliation_items").select("*").limit(2000);
    if (error) {
      return NextResponse.json({ ok: false, error: "جدول تطبیق NOT READY است." }, { status: 503 });
    }
    headers = ["id", "kind", "status", "severity", "source", "target", "expected", "actual", "delta", "detected_at"];
    rows = (data ?? []) as Record<string, unknown>[];
  } else if (type === "treasury") {
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: "export.csv",
      entity: "export",
      entityId: type,
      result: "denied",
      meta: { note: "Treasury snapshot export NOT READY" },
    });
    return NextResponse.json({ ok: false, error: "Treasury snapshot NOT READY — صفر جعلی صادر نمی‌شود." }, { status: 503 });
  }

  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: "export.csv",
    entity: "export",
    entityId: type,
    result: "ok",
    meta: { rows: rows.length, pii: "masked" },
  });

  void maskIban;
  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="geram-${type}.csv"`,
    },
  });
}
