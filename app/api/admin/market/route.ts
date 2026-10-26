import { NextResponse } from "next/server";
import { adminGate } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { simulateTgjuDown, tgjuSimulatedDownUntil } from "@/lib/market/estjt";

export const dynamic = "force-dynamic";

/** Ops drill: { simulateTgjuDownMinutes: 0..60 } makes TGJU look down so quotes fall back to estjt. */
export async function POST(request: Request) {
  const gate = await adminGate("switches.write");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const minutes = Math.max(0, Math.min(60, Math.floor(Number(body.simulateTgjuDownMinutes ?? 0)) || 0));
  simulateTgjuDown(minutes);
  await writeAudit({
    actorId: gate.ctx.userId,
    role: gate.ctx.role,
    action: minutes ? "market.simulate_tgju_down" : "market.simulate_tgju_restore",
    entity: "market_source",
    entityId: "tgju",
    reason: minutes ? `${minutes} min drill` : "restore",
  });
  const until = tgjuSimulatedDownUntil();
  return NextResponse.json({ ok: true, simulatedDownUntil: until ? new Date(until).toISOString() : null });
}
