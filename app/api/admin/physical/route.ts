import { NextResponse } from "next/server";
import { adminGate } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { jsonError } from "@/lib/core/http";
import { gramsToUg } from "@/lib/core/money";
import { transitionPhysical, upsertProduct } from "@/lib/physical/service";
import { physicalSettingsSchema, savePhysicalSettings } from "@/lib/physical/settings";

export const dynamic = "force-dynamic";

const MESSAGES = {
  approve: "نوبت تحویل تأیید شد.",
  deliver: "تحویل ثبت شد و فلز از دفترکل خارج شد.",
  reject: "درخواست رد شد و فلز به کاربر برگشت.",
} as const;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "settings" || action === "product") {
    const gate = await adminGate("settings.write");
    if (!gate.ok) return gate.response;
    try {
      if (action === "settings") {
        const parsed = physicalSettingsSchema.safeParse(body.settings);
        if (!parsed.success) {
          return NextResponse.json({ ok: false, error: "invalid_settings", message: "تنظیمات نامعتبر است." }, { status: 400 });
        }
        await savePhysicalSettings(parsed.data);
      } else {
        const p = body.product as Record<string, unknown>;
        const grams = String(p?.grams ?? "").trim();
        if (!p || !/^\d+(\.\d{1,3})?$/.test(grams) || Number(grams) <= 0 || String(p.title ?? "").trim().length < 2) {
          return NextResponse.json({ ok: false, error: "invalid_product", message: "عنوان و وزن محصول را درست وارد کنید." }, { status: 400 });
        }
        const asset = String(p.asset);
        if (!["GOLD", "SILVER", "COPPER"].includes(asset)) {
          return NextResponse.json({ ok: false, error: "invalid_asset" }, { status: 400 });
        }
        await upsertProduct({
          id: typeof p.id === "string" && p.id ? p.id : undefined,
          asset: asset as "GOLD",
          kind: p.kind === "COIN" ? "COIN" : "BAR",
          title: String(p.title).trim(),
          weightUg: gramsToUg(Number(grams)),
          active: p.active !== false && p.active !== "false",
          sort: Number(p.sort ?? 0) || 0,
        });
      }
      await writeAudit({
        actorId: gate.ctx.userId,
        role: gate.ctx.role,
        action: `physical.${action}`,
        entity: "physical",
        meta: { body: action === "settings" ? body.settings : body.product },
      });
      return NextResponse.json({ ok: true, message: "ذخیره شد." });
    } catch (err) {
      return jsonError(err);
    }
  }

  if (action !== "approve" && action !== "deliver" && action !== "reject") {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }
  const gate = await adminGate("treasury.write");
  if (!gate.ok) return gate.response;
  const id = String(body.id ?? "");
  const reason = String(body.reason ?? "").trim();
  if (!id || reason.length < 3) {
    return NextResponse.json({ ok: false, error: "invalid_request", message: "توضیح لازم است." }, { status: 400 });
  }
  try {
    const row = await transitionPhysical({ id, action, actorId: gate.ctx.userId, note: reason });
    await writeAudit({
      actorId: gate.ctx.userId,
      role: gate.ctx.role,
      action: `physical.${action}`,
      entity: "physical_withdrawal",
      entityId: id,
      reason,
    });
    return NextResponse.json({ ok: true, request: row, message: MESSAGES[action] });
  } catch (err) {
    return jsonError(err);
  }
}
