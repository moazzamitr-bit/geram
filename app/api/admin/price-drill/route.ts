import { NextResponse } from "next/server";
import { adminGate, readActionBody } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { setPriceDrill } from "@/lib/core/price-guard";
import type { AssetCode } from "@/lib/core/assets";

/** Ops drill: feed a 10x-wrong price into the guard to prove halt + rejection. */
export async function POST(request: Request) {
  const gate = await adminGate("switches.write");
  if (!gate.ok) return gate.response;
  const body = await readActionBody(request);
  const asset = (body.asset ?? "GOLD") as AssetCode;
  if (!["GOLD", "SILVER", "COPPER"].includes(asset)) {
    return NextResponse.json({ ok: false, error: "invalid_asset" }, { status: 400 });
  }
  const divisor = Number(body.divisor ?? 10);
  setPriceDrill(asset, divisor, 2);
  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: "price_guard.drill",
    entity: "price_guard",
    entityId: asset,
    reason: "price guard drill",
    result: "ok",
    meta: { divisor },
  });
  return NextResponse.json({ ok: true, asset, divisor, minutes: 2 });
}
