import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { createLotState, consumeLotsFifo } from "@/lib/treasury/inventory";
import {
  applyConsumeToWac,
  applyPurchaseToWac,
  emptyWacPool,
  wacPerMg,
} from "@/lib/treasury/wac";
import { computePosition } from "@/lib/treasury/position";
import {
  quoteWithSpread,
  spreadRevenueCustomerBuy,
  spreadRevenueCustomerSell,
} from "@/lib/treasury/spread";
import { realizeTradePnl } from "@/lib/treasury/pnl";
import {
  loadSpreadSettings,
  loadTreasuryRiskSettings,
} from "@/lib/treasury/settings";
import { recommendReplenishment } from "@/lib/treasury/replenishment";
import type { TreasuryAsset, WacPool } from "@/lib/treasury/types";

type AdminClient = ReturnType<typeof createServiceClient>;

async function audit(
  admin: AdminClient,
  action: string,
  entityType: string,
  entityId: string | null,
  actorId: string | null | undefined,
  payload: Record<string, unknown>
) {
  await admin.from("treasury_audit_log").insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    actor_id: actorId ?? null,
    payload,
  });
}

export async function rebuildWacPool(
  admin: AdminClient,
  asset: TreasuryAsset
): Promise<WacPool> {
  const { data } = await admin
    .from("inventory_movements")
    .select("movement_type, weight_mg, cost_toman")
    .eq("asset", asset)
    .order("created_at", { ascending: true });

  let pool = emptyWacPool(asset);
  for (const row of data ?? []) {
    const w = Number(row.weight_mg);
    const c = Number(row.cost_toman);
    if (
      row.movement_type === "PURCHASE" ||
      row.movement_type === "ACQUIRE_CUSTOMER_SELL"
    ) {
      pool = applyPurchaseToWac(pool, w, c);
    } else if (row.movement_type === "CONSUME_CUSTOMER_BUY") {
      // cost_toman stored as positive magnitude; apply consume by weight
      const next = applyConsumeToWac(pool, w);
      pool = next.pool;
    }
  }
  return pool;
}

export async function sumReservedMg(
  admin: AdminClient,
  asset: TreasuryAsset
): Promise<number> {
  const { data } = await admin
    .from("inventory_reservations")
    .select("weight_mg")
    .eq("asset", asset)
    .eq("status", "OPEN");
  return (data ?? []).reduce((s, r) => s + Number(r.weight_mg || 0), 0);
}

export async function sumCustomerLiabilityMg(
  admin: AdminClient,
  asset: TreasuryAsset
): Promise<number> {
  if (asset !== "GOLD") {
    // Future multi-asset holdings table; GOLD uses wallets.gold_mg today.
    return 0;
  }
  const { data } = await admin.from("wallets").select("gold_mg");
  return (data ?? []).reduce((s, w) => s + Number(w.gold_mg || 0), 0);
}

export async function physicalFromActiveLots(
  admin: AdminClient,
  asset: TreasuryAsset
): Promise<number> {
  const { data } = await admin
    .from("inventory_lots")
    .select("remaining_mg")
    .eq("asset", asset)
    .eq("status", "ACTIVE");
  return (data ?? []).reduce((s, l) => s + Number(l.remaining_mg || 0), 0);
}

export async function getTreasuryPosition(
  asset: TreasuryAsset,
  marketPriceTomanPerGram: number
) {
  const admin = createServiceClient();
  const [pool, physical, liability, reserved] = await Promise.all([
    rebuildWacPool(admin, asset),
    physicalFromActiveLots(admin, asset),
    sumCustomerLiabilityMg(admin, asset),
    sumReservedMg(admin, asset),
  ]);
  return computePosition({
    asset,
    physicalInventoryMg: physical,
    customerLiabilityMg: liability,
    reservedInventoryMg: reserved,
    pool,
    marketPriceTomanPerGram,
  });
}

/** Execute approved inventory purchase — creates lot + PURCHASE movement. */
export async function executeInventoryPurchase(input: {
  asset: TreasuryAsset;
  weightMg: number;
  acquisitionCostToman: number;
  supplier: string;
  actorId?: string;
  procurementId?: string;
  purchasedAt?: string;
}) {
  if (input.weightMg <= 0) throw new Error("invalid_weight");
  if (input.acquisitionCostToman < 0) throw new Error("invalid_cost");

  const admin = createServiceClient();
  const lotId = randomUUID();
  const lot = createLotState(lotId, {
    asset: input.asset,
    weightMg: input.weightMg,
    acquisitionCostToman: input.acquisitionCostToman,
    supplier: input.supplier,
    purchasedAt: input.purchasedAt,
  });

  const { error: lotErr } = await admin.from("inventory_lots").insert({
    id: lot.id,
    asset: lot.asset,
    weight_mg: lot.weightMg,
    remaining_mg: lot.remainingMg,
    acquisition_cost_toman: lot.acquisitionCostToman,
    unit_cost_toman_per_mg: lot.unitCostTomanPerMg,
    supplier: lot.supplier,
    purchased_at: lot.purchasedAt ?? new Date().toISOString(),
    status: "ACTIVE",
    procurement_id: input.procurementId ?? null,
    created_by: input.actorId ?? null,
  });
  if (lotErr) throw lotErr;

  const { error: movErr } = await admin.from("inventory_movements").insert({
    asset: input.asset,
    movement_type: "PURCHASE",
    weight_mg: input.weightMg,
    cost_toman: input.acquisitionCostToman,
    lot_id: lot.id,
    source: "procurement",
    source_ref: input.procurementId ?? lot.id,
    actor_id: input.actorId ?? null,
    meta: { supplier: input.supplier },
  });
  if (movErr) throw movErr;

  await audit(admin, "INVENTORY_PURCHASE", "inventory_lot", lot.id, input.actorId, {
    asset: input.asset,
    weightMg: input.weightMg,
    acquisitionCostToman: input.acquisitionCostToman,
    supplier: input.supplier,
  });

  return lot;
}

async function loadActiveLots(admin: AdminClient, asset: TreasuryAsset) {
  const { data, error } = await admin
    .from("inventory_lots")
    .select("*")
    .eq("asset", asset)
    .eq("status", "ACTIVE")
    .order("purchased_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    asset: row.asset as TreasuryAsset,
    weightMg: Number(row.weight_mg),
    remainingMg: Number(row.remaining_mg),
    acquisitionCostToman: Number(row.acquisition_cost_toman),
    unitCostTomanPerMg: Number(row.unit_cost_toman_per_mg),
    supplier: String(row.supplier ?? ""),
    purchasedAt: String(row.purchased_at ?? ""),
    status: row.status as "ACTIVE" | "DEPLETED" | "VOID",
  }));
}

/**
 * Book a customer buy into treasury:
 * - consume lots FIFO (if inventory available)
 * - CONSUME movement at WAC
 * - treasury_trades with spread + fee (separate)
 *
 * If physical inventory is short, still records trade economics and
 * liability impact is reflected via wallets; coverage drops → replenishment.
 */
export async function bookCustomerBuy(input: {
  asset: TreasuryAsset;
  weightMg: number;
  midPriceTomanPerGram: number;
  /** Actual price charged to customer for metal (defaults to mid — UI unchanged) */
  customerPriceTomanPerGram?: number;
  feeRevenueToman: number;
  transactionId?: string;
  userId?: string;
  actorId?: string;
  allowShortInventory?: boolean;
}) {
  const admin = createServiceClient();
  if (input.transactionId) {
    const { data: existing } = await admin
      .from("treasury_trades")
      .select("id")
      .eq("transaction_id", input.transactionId)
      .maybeSingle();
    if (existing) {
      return {
        tradeId: existing.id as string,
        pnl: {
          revenueToman: 0,
          costToman: 0,
          realizedPnlToman: 0,
        },
        quote: quoteWithSpread(input.asset, input.midPriceTomanPerGram),
        shortInventory: false,
        deduped: true as const,
      };
    }
  }
  const spreadSettings = await loadSpreadSettings();
  const pool = await rebuildWacPool(admin, input.asset);
  const physical = await physicalFromActiveLots(admin, input.asset);
  const liability = await sumCustomerLiabilityMg(admin, input.asset);
  const coverage =
    liability > 0 ? physical / Math.max(liability, 1) : null;

  const quote = quoteWithSpread(input.asset, input.midPriceTomanPerGram, spreadSettings, {
    coverageRatio: coverage,
  });

  const customerPrice =
    input.customerPriceTomanPerGram ?? input.midPriceTomanPerGram;
  const spreadRev = spreadRevenueCustomerBuy(
    input.weightMg,
    input.midPriceTomanPerGram,
    customerPrice
  );

  let inventoryCost = 0;
  let wacUsed = wacPerMg(pool);
  const short = input.weightMg > pool.totalWeightMg;

  if (!short) {
    const consumed = applyConsumeToWac(pool, input.weightMg);
    inventoryCost = consumed.costToman;
    wacUsed = consumed.wacTomanPerMg;

    const lots = await loadActiveLots(admin, input.asset);
    const { consumptions } = consumeLotsFifo(lots, input.asset, input.weightMg);
    for (const c of consumptions) {
      const lot = lots.find((l) => l.id === c.lotId)!;
      const remaining = lot.remainingMg - c.weightMg;
      const { error } = await admin
        .from("inventory_lots")
        .update({
          remaining_mg: remaining,
          status: remaining === 0 ? "DEPLETED" : "ACTIVE",
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.lotId);
      if (error) throw error;

      const portionCost = Math.floor(
        inventoryCost * (c.weightMg / input.weightMg)
      );
      await admin.from("inventory_movements").insert({
        asset: input.asset,
        movement_type: "CONSUME_CUSTOMER_BUY",
        weight_mg: c.weightMg,
        cost_toman: portionCost,
        lot_id: c.lotId,
        source: "customer_buy",
        source_ref: input.transactionId ?? null,
        actor_id: input.actorId ?? input.userId ?? null,
        meta: { wacTomanPerMg: wacUsed },
      });
    }
  } else if (!input.allowShortInventory) {
    throw new Error("insufficient_inventory");
  } else {
    // Short inventory: record zero COGS consume marker in audit only
    await audit(
      admin,
      "CUSTOMER_BUY_UNCOVERED",
      "treasury_trade",
      input.transactionId ?? null,
      input.actorId ?? input.userId,
      { asset: input.asset, weightMg: input.weightMg, physical }
    );
  }

  const pnl = realizeTradePnl({
    side: "CUSTOMER_BUY",
    spreadRevenueToman: spreadRev,
    feeRevenueToman: input.feeRevenueToman,
    inventoryCostToman: inventoryCost,
  });

  const { data: trade, error: tradeErr } = await admin
    .from("treasury_trades")
    .insert({
      asset: input.asset,
      side: "CUSTOMER_BUY",
      weight_mg: input.weightMg,
      mid_price_toman_per_gram: input.midPriceTomanPerGram,
      customer_price_toman_per_gram: customerPrice,
      spread_bps: quote.buySpreadBps,
      spread_revenue_toman: spreadRev,
      fee_revenue_toman: input.feeRevenueToman,
      inventory_cost_toman: inventoryCost,
      realized_pnl_toman: pnl.realizedPnlToman,
      transaction_id: input.transactionId ?? null,
      user_id: input.userId ?? null,
      wac_toman_per_mg: wacUsed,
      meta: {
        shortInventory: short,
        indicatedBuyPrice: quote.customerBuyPriceTomanPerGram,
        indicatedSpreadBps: quote.buySpreadBps,
      },
    })
    .select("id")
    .maybeSingle();
  if (tradeErr) throw tradeErr;

  await audit(
    admin,
    "BOOK_CUSTOMER_BUY",
    "treasury_trade",
    trade?.id ?? null,
    input.actorId ?? input.userId,
    { weightMg: input.weightMg, pnl }
  );

  return { tradeId: trade?.id, pnl, quote, shortInventory: short };
}

export async function bookCustomerSell(input: {
  asset: TreasuryAsset;
  weightMg: number;
  midPriceTomanPerGram: number;
  customerPriceTomanPerGram?: number;
  feeRevenueToman: number;
  /** Amount paid to customer for metal (acquisition cost for inventory) */
  customerNetToman: number;
  transactionId?: string;
  userId?: string;
  actorId?: string;
}) {
  const admin = createServiceClient();
  if (input.transactionId) {
    const { data: existing } = await admin
      .from("treasury_trades")
      .select("id")
      .eq("transaction_id", input.transactionId)
      .maybeSingle();
    if (existing) {
      return {
        tradeId: existing.id as string,
        pnl: { revenueToman: 0, costToman: 0, realizedPnlToman: 0 },
        quote: quoteWithSpread(input.asset, input.midPriceTomanPerGram),
        lotId: null as string | null,
        deduped: true as const,
      };
    }
  }
  const spreadSettings = await loadSpreadSettings();
  const physical = await physicalFromActiveLots(admin, input.asset);
  const liability = await sumCustomerLiabilityMg(admin, input.asset);
  const coverage = liability > 0 ? physical / Math.max(liability, 1) : null;

  const quote = quoteWithSpread(input.asset, input.midPriceTomanPerGram, spreadSettings, {
    coverageRatio: coverage,
  });

  const customerPrice =
    input.customerPriceTomanPerGram ?? input.midPriceTomanPerGram;
  const spreadRev = spreadRevenueCustomerSell(
    input.weightMg,
    input.midPriceTomanPerGram,
    customerPrice
  );

  // Acquisition cost = what platform paid customer for the metal
  const acquisitionCost = Math.max(0, input.customerNetToman);

  const lot = await executeInventoryPurchase({
    asset: input.asset,
    weightMg: input.weightMg,
    acquisitionCostToman: acquisitionCost,
    supplier: `customer:${input.userId ?? "unknown"}`,
    actorId: input.actorId ?? input.userId,
  });

  // Retag movement as ACQUIRE_CUSTOMER_SELL (purchase helper wrote PURCHASE)
  await admin
    .from("inventory_movements")
    .update({
      movement_type: "ACQUIRE_CUSTOMER_SELL",
      source: "customer_sell",
      source_ref: input.transactionId ?? lot.id,
    })
    .eq("lot_id", lot.id)
    .eq("movement_type", "PURCHASE");

  const pnl = realizeTradePnl({
    side: "CUSTOMER_SELL",
    spreadRevenueToman: spreadRev,
    feeRevenueToman: input.feeRevenueToman,
    inventoryCostToman: 0,
    metalAcquisitionToman: acquisitionCost,
  });

  const { data: trade, error: tradeErr } = await admin
    .from("treasury_trades")
    .insert({
      asset: input.asset,
      side: "CUSTOMER_SELL",
      weight_mg: input.weightMg,
      mid_price_toman_per_gram: input.midPriceTomanPerGram,
      customer_price_toman_per_gram: customerPrice,
      spread_bps: quote.sellSpreadBps,
      spread_revenue_toman: spreadRev,
      fee_revenue_toman: input.feeRevenueToman,
      inventory_cost_toman: 0,
      realized_pnl_toman: pnl.realizedPnlToman,
      transaction_id: input.transactionId ?? null,
      user_id: input.userId ?? null,
      meta: {
        lotId: lot.id,
        acquisitionCost,
        indicatedSellPrice: quote.customerSellPriceTomanPerGram,
        indicatedSpreadBps: quote.sellSpreadBps,
      },
    })
    .select("id")
    .maybeSingle();
  if (tradeErr) throw tradeErr;

  await audit(
    admin,
    "BOOK_CUSTOMER_SELL",
    "treasury_trade",
    trade?.id ?? null,
    input.actorId ?? input.userId,
    { weightMg: input.weightMg, pnl, lotId: lot.id }
  );

  return { tradeId: trade?.id, pnl, quote, lotId: lot.id };
}

export async function createReplenishmentRecommendation(input: {
  asset: TreasuryAsset;
  marketPriceTomanPerGram?: number;
  actorId?: string;
}) {
  const admin = createServiceClient();
  const risk = await loadTreasuryRiskSettings();
  const physical = await physicalFromActiveLots(admin, input.asset);
  const liability = await sumCustomerLiabilityMg(admin, input.asset);
  const rec = recommendReplenishment({
    asset: input.asset,
    physicalInventoryMg: physical,
    customerLiabilityMg: liability,
    marketPriceTomanPerGram: input.marketPriceTomanPerGram,
    settings: risk,
  });
  if (!rec) return null;

  const estimated =
    input.marketPriceTomanPerGram && input.marketPriceTomanPerGram > 0
      ? Math.floor((rec.recommendedWeightMg / 1000) * input.marketPriceTomanPerGram)
      : null;

  const { data, error } = await admin
    .from("replenishment_recommendations")
    .insert({
      asset: rec.asset,
      recommended_weight_mg: rec.recommendedWeightMg,
      reason: rec.reason,
      coverage_before: rec.coverageBefore,
      coverage_target: rec.coverageTarget,
      status: "PENDING",
      estimated_cost_toman: estimated,
      created_by: input.actorId ?? null,
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;

  await audit(
    admin,
    "REPLENISHMENT_CREATED",
    "replenishment",
    data?.id ?? null,
    input.actorId,
    rec
  );
  return data;
}

export async function decideReplenishment(input: {
  id: string;
  decision: "APPROVED" | "REJECTED";
  actorId: string;
  supplier?: string;
  acquisitionCostToman?: number;
}) {
  const admin = createServiceClient();
  const { data: row, error } = await admin
    .from("replenishment_recommendations")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("not_found");
  if (row.status !== "PENDING") throw new Error("not_pending");

  if (input.decision === "REJECTED") {
    await admin
      .from("replenishment_recommendations")
      .update({
        status: "REJECTED",
        decided_by: input.actorId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    await audit(admin, "REPLENISHMENT_REJECTED", "replenishment", input.id, input.actorId, {});
    return { status: "REJECTED" as const };
  }

  const cost =
    input.acquisitionCostToman ??
    Number(row.estimated_cost_toman ?? 0);
  if (cost <= 0) throw new Error("acquisition_cost_required");

  await admin
    .from("replenishment_recommendations")
    .update({
      status: "APPROVED",
      supplier: input.supplier ?? row.supplier,
      acquisition_cost_toman: cost,
      decided_by: input.actorId,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  await audit(admin, "REPLENISHMENT_APPROVED", "replenishment", input.id, input.actorId, {
    cost,
  });
  return { status: "APPROVED" as const };
}

export async function executeReplenishment(input: {
  id: string;
  actorId: string;
  supplier?: string;
  acquisitionCostToman?: number;
}) {
  const admin = createServiceClient();
  const { data: row, error } = await admin
    .from("replenishment_recommendations")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("not_found");
  if (row.status !== "APPROVED" && row.status !== "PENDING") {
    throw new Error("invalid_status");
  }
  // Require explicit approval first
  if (row.status === "PENDING") throw new Error("approval_required");

  const cost =
    input.acquisitionCostToman ??
    Number(row.acquisition_cost_toman ?? row.estimated_cost_toman ?? 0);
  if (cost <= 0) throw new Error("acquisition_cost_required");

  const lot = await executeInventoryPurchase({
    asset: row.asset as TreasuryAsset,
    weightMg: Number(row.recommended_weight_mg),
    acquisitionCostToman: cost,
    supplier: input.supplier ?? row.supplier ?? "approved-procurement",
    actorId: input.actorId,
    procurementId: row.id,
  });

  await admin
    .from("replenishment_recommendations")
    .update({
      status: "EXECUTED",
      executed_lot_id: lot.id,
      acquisition_cost_toman: cost,
      supplier: input.supplier ?? row.supplier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  await audit(admin, "REPLENISHMENT_EXECUTED", "replenishment", input.id, input.actorId, {
    lotId: lot.id,
  });
  return { lotId: lot.id };
}
