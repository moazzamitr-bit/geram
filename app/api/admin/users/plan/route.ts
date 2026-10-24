import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/admin/audit";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { parsePlanTier, planTierPatch } from "@/lib/admin/plan-tier";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await adminGate("user.plan");
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const userId = (body.userId ?? "").trim();
  const tier = parsePlanTier(body.planTier ?? body.plan_tier ?? "");
  const reason = (body.reason ?? "").trim();
  if (!userId || !tier || reason.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  const { data: profile } = await db
    .from("profiles")
    .select("id, plan_tier, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const patch = planTierPatch(tier);
  const { error } = await db.from("profiles").update(patch).eq("id", userId);
  if (error) {
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: "user.plan_tier",
      entity: "profile",
      entityId: userId,
      reason,
      result: "error",
      meta: { from: profile.plan_tier, to: tier },
    });
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }

  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: "user.plan_tier",
    entity: "profile",
    entityId: userId,
    reason,
    result: "ok",
    meta: {
      from: profile.plan_tier ?? "free",
      fromExpiresAt: profile.plan_expires_at,
      to: patch.plan_tier,
      toExpiresAt: patch.plan_expires_at,
    },
  });

  const message = tier === "free" ? "پلن کاربر به رایگان برگشت." : "پلن پلاس برای این کاربر فعال شد.";
  return NextResponse.json({ ok: true, message, planTier: patch.plan_tier });
}
