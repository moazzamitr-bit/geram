import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/admin/rbac";
import { safeFinnotechLog } from "@/lib/finnotech/client";
import { refreshStoredIdentity } from "@/lib/kyc/actions";
import { KycFlowError } from "@/lib/kyc/flow";

const ACTIONS = new Set([
  "retry_provider",
  "request_resubmission",
  "manual_review",
  "approve",
  "reject",
  "escalate",
]);

export async function POST(request: Request) {
  const gate = await adminGate("kyc.review");
  if (!gate.ok) return gate.response;

  const body = await readActionBody(request);
  const userId = (body.userId ?? "").trim();
  const action = (body.action ?? "").trim();
  const reason = (body.reason ?? "").trim();

  if (!userId || !ACTIONS.has(action) || reason.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  if (action === "approve" && !hasPermission(gate.ctx.role, "kyc.approve_verified")) {
    return NextResponse.json(
      { ok: false, error: "تأیید دستی KYC فقط با نقش SUPER_ADMIN مجاز است." },
      { status: 403 }
    );
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }

  const { data: profile } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (action === "retry_provider") {
    try {
      const refreshed = await refreshStoredIdentity(userId);
      await writeAudit({
        actorId: gate.ctx.userId,
        role: gate.ctx.role,
        action: "kyc.retry_provider",
        entity: "profile",
        entityId: userId,
        reason,
        result: refreshed.ok ? "ok" : "error",
        meta: {
          oldStatus: profile.kyc_status,
          provider: "finnotech",
          outcome: refreshed.ok ? refreshed.status : refreshed.error,
          trackId: refreshed.ok ? refreshed.trackId : null,
        },
      });
      return NextResponse.json({
        ok: refreshed.ok,
        message: refreshed.ok
          ? "استعلام ثبت احوال دوباره انجام شد."
          : "کد ملی و تاریخ تولد ذخیره نشده؛ استعلام دوباره ممکن نیست.",
      });
    } catch (err) {
      safeFinnotechLog("kyc_admin_retry", err);
      const message =
        err instanceof KycFlowError ? err.message : "استعلام فینوتک انجام نشد.";
      await writeAudit({
        actorId: gate.ctx.userId,
        role: gate.ctx.role,
        action: "kyc.retry_provider",
        entity: "profile",
        entityId: userId,
        reason,
        result: "error",
        meta: { provider: "finnotech" },
      });
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  }

  const patch: Record<string, unknown> = {};
  if (action === "request_resubmission") patch.kyc_status = "NEEDS_UPDATE";
  if (action === "manual_review") patch.kyc_status = "PENDING";
  if (action === "reject") patch.kyc_status = "REJECTED";
  if (action === "approve") patch.kyc_status = "VERIFIED";

  if (Object.keys(patch).length) {
    await db.from("profiles").update(patch).eq("id", userId);
  }

  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: `kyc.${action}`,
    entity: "profile",
    entityId: userId,
    reason,
    result: "ok",
    meta: {
      oldStatus: profile.kyc_status,
      newStatus: patch.kyc_status ?? profile.kyc_status,
    },
  });

  return NextResponse.json({ ok: true, message: "ثبت شد." });
}
