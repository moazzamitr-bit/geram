import { NextResponse } from "next/server";
import { adminGate } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import {
  mergeWithDefaults,
  parseCommerceSettings,
  saveCommerceSettings,
} from "@/lib/commerce/save-settings";
import { DEFAULT_COMMERCE_SETTINGS } from "@/lib/commerce/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await adminGate("settings.view");
  if (!gate.ok) return gate.response;

  const settings = await loadCommerceSettings().catch(() => DEFAULT_COMMERCE_SETTINGS);
  return NextResponse.json({ ok: true, settings });
}

export async function PUT(request: Request) {
  const gate = await adminGate("settings.write");
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 8) {
      return NextResponse.json({ ok: false, error: "reason_required" }, { status: 400 });
    }
    const previous = await loadCommerceSettings().catch(() => DEFAULT_COMMERCE_SETTINGS);
    const parsed = parseCommerceSettings(mergeWithDefaults(body));
    const settings = await saveCommerceSettings(parsed);
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: "settings.commerce.update",
      entity: "commerce_settings",
      entityId: "global",
      reason,
      result: "ok",
      meta: { old: previous, next: settings },
    });
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "save_failed" },
      { status: 400 }
    );
  }
}
