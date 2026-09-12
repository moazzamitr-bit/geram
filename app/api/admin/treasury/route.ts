import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/db/admin-queries";
import {
  decideReplenishment,
  executeInventoryPurchase,
  executeReplenishment,
  createReplenishmentRecommendation,
} from "@/lib/treasury/service";
import {
  loadSpreadSettings,
  loadTreasuryRiskSettings,
  saveSpreadSettings,
  saveTreasuryRiskSettings,
  mergeSpreadSettings,
  mergeTreasuryRiskSettings,
} from "@/lib/treasury/settings";
import { isTreasuryAsset } from "@/lib/treasury/types";
import { getLiveGold18Price } from "@/lib/market/price-provider";

export const dynamic = "force-dynamic";

async function adminActor() {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.reason === "forbidden" ? "forbidden" : "unauthorized");
  return auth.user.id;
}

export async function GET(request: Request) {
  try {
    await adminActor();
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "settings";
    if (view === "settings") {
      const [spread, treasury] = await Promise.all([
        loadSpreadSettings(),
        loadTreasuryRiskSettings(),
      ]);
      return NextResponse.json({ ok: true, spread, treasury });
    }
    return NextResponse.json({ ok: false, error: "unknown_view" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unauthorized";
    const status = message === "unauthorized" || message === "forbidden" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

const purchaseSchema = z.object({
  action: z.literal("purchase"),
  asset: z.string(),
  weightMg: z.number().int().positive(),
  acquisitionCostToman: z.number().int().nonnegative(),
  supplier: z.string().min(1),
});

const replenishCreateSchema = z.object({
  action: z.literal("replenish_create"),
  asset: z.string().default("GOLD"),
});

const replenishDecideSchema = z.object({
  action: z.literal("replenish_decide"),
  id: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  supplier: z.string().optional(),
  acquisitionCostToman: z.number().int().positive().optional(),
});

const replenishExecuteSchema = z.object({
  action: z.literal("replenish_execute"),
  id: z.string().uuid(),
  supplier: z.string().optional(),
  acquisitionCostToman: z.number().int().positive().optional(),
});

const spreadSaveSchema = z.object({
  action: z.literal("save_spread"),
  spread: z.record(z.string(), z.unknown()),
});

const treasurySaveSchema = z.object({
  action: z.literal("save_treasury"),
  treasury: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  try {
    const actorId = await adminActor();
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "service_role_required" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const action = body?.action as string;

    if (action === "purchase") {
      const parsed = purchaseSchema.parse(body);
      if (!isTreasuryAsset(parsed.asset)) {
        return NextResponse.json({ ok: false, error: "invalid_asset" }, { status: 400 });
      }
      const lot = await executeInventoryPurchase({
        ...parsed,
        asset: parsed.asset,
        actorId,
      });
      return NextResponse.json({ ok: true, lot });
    }

    if (action === "replenish_create") {
      const parsed = replenishCreateSchema.parse(body);
      if (!isTreasuryAsset(parsed.asset)) {
        return NextResponse.json({ ok: false, error: "invalid_asset" }, { status: 400 });
      }
      const price =
        parsed.asset === "GOLD"
          ? (await getLiveGold18Price()).priceToman
          : undefined;
      const row = await createReplenishmentRecommendation({
        asset: parsed.asset,
        marketPriceTomanPerGram: price,
        actorId,
      });
      return NextResponse.json({ ok: true, recommendation: row });
    }

    if (action === "replenish_decide") {
      const parsed = replenishDecideSchema.parse(body);
      const result = await decideReplenishment({
        id: parsed.id,
        decision: parsed.decision,
        actorId,
        supplier: parsed.supplier,
        acquisitionCostToman: parsed.acquisitionCostToman,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "replenish_execute") {
      const parsed = replenishExecuteSchema.parse(body);
      const result = await executeReplenishment({
        id: parsed.id,
        actorId,
        supplier: parsed.supplier,
        acquisitionCostToman: parsed.acquisitionCostToman,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "save_spread") {
      const parsed = spreadSaveSchema.parse(body);
      const settings = mergeSpreadSettings(parsed.spread);
      await saveSpreadSettings(settings, actorId);
      return NextResponse.json({ ok: true, spread: settings });
    }

    if (action === "save_treasury") {
      const parsed = treasurySaveSchema.parse(body);
      const settings = mergeTreasuryRiskSettings(parsed.treasury);
      await saveTreasuryRiskSettings(settings, actorId);
      return NextResponse.json({ ok: true, treasury: settings });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    const status =
      message === "unauthorized" || message === "forbidden"
        ? 401
        : message === "approval_required" || message === "not_pending"
          ? 409
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
