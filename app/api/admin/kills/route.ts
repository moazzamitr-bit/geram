import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";
import { KILL_SWITCH_KEYS } from "@/lib/core/mode";

export async function POST(request: Request) {
  const gate = await adminGate("switches.write");
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const key = (body.key ?? "").trim();
  const enabled = body.enabled === "true" || body.enabled === "1";
  const reason = (body.reason ?? "").trim();

  if (!KILL_SWITCH_KEYS.includes(key as (typeof KILL_SWITCH_KEYS)[number]) || reason.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  const { error } = await db.from("admin_kill_switches").upsert({
    key,
    enabled,
    reason,
    actor_id: gate.ctx.userId,
    updated_at: new Date().toISOString(),
  });

  if (!error) {
    await db.from("core_kill_switches").upsert({
      key,
      enabled,
      updated_at: new Date().toISOString(),
    });
  }

  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: "kill_switch.update",
    entity: "kill_switch",
    entityId: key,
    reason,
    result: error ? "error" : "ok",
    meta: {
      enabled,
      error: error?.message ?? null,
      note: "Trading engine still reads env getKillSwitches() until wired. Postgres is intended authority.",
    },
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "جدول admin_kill_switches آماده نیست. سوئیچ‌ها هنوز از env خوانده می‌شوند. NOT READY.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "در Postgres ثبت شد. موتور معامله هنوز env را می‌خواند تا سیم‌کشی کامل شود — وضعیت DEGRADED.",
  });
}
