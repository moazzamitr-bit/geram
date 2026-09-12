import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/db/types";
import {
  getTreasuryPosition,
  createReplenishmentRecommendation,
} from "@/lib/treasury/service";
import { aggregatePeriodPnl } from "@/lib/treasury/pnl";
import { simulatePriceShock, summarizeExposure } from "@/lib/treasury/risk";
import {
  loadSpreadSettings,
  loadTreasuryRiskSettings,
} from "@/lib/treasury/settings";
import { formatBuyRecommendation, recommendReplenishment } from "@/lib/treasury/replenishment";
import { TREASURY_ASSETS, type TreasuryAsset } from "@/lib/treasury/types";
import { getLiveGold18Price } from "@/lib/market/price-provider";

async function midPrice(asset: TreasuryAsset): Promise<number> {
  if (asset === "GOLD") {
    const q = await getLiveGold18Price();
    return q.priceToman || 0;
  }
  // Placeholder mids until silver/copper feeds exist
  if (asset === "SILVER") return 80_000;
  return 5_000;
}

export async function getTreasuryDashboard(asset: TreasuryAsset = "GOLD") {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { connected: false as const, asset };
  }
  try {
    const price = await midPrice(asset);
    const [position, spread, risk, admin] = await Promise.all([
      getTreasuryPosition(asset, price),
      loadSpreadSettings(),
      loadTreasuryRiskSettings(),
      Promise.resolve(createServiceClient()),
    ]);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [{ data: trades }, { data: ops }] = await Promise.all([
      admin
        .from("treasury_trades")
        .select(
          "spread_revenue_toman, fee_revenue_toman, inventory_cost_toman, realized_pnl_toman, created_at"
        )
        .eq("asset", asset)
        .gte("created_at", since.toISOString()),
      admin
        .from("operational_costs")
        .select("amount_toman")
        .gte("incurred_at", since.toISOString()),
    ]);

    const period = aggregatePeriodPnl({
      trades: (trades ?? []).map((t) => ({
        spreadRevenueToman: Number(t.spread_revenue_toman),
        feeRevenueToman: Number(t.fee_revenue_toman),
        inventoryCostToman: Number(t.inventory_cost_toman),
        realizedPnlToman: Number(t.realized_pnl_toman),
      })),
      operationalCostToman: (ops ?? []).reduce(
        (s, o) => s + Number(o.amount_toman),
        0
      ),
      inventoryMarketValueToman: position.inventoryMarketValueToman,
      inventoryBookValueToman: position.inventoryBookValueToman,
    });

    return {
      connected: true as const,
      asset,
      position,
      period,
      spread,
      risk,
      exposure: summarizeExposure(
        position,
        risk.coverageCritical,
        risk.coverageTarget
      ),
      scenarios: simulatePriceShock(position),
    };
  } catch {
    return { connected: false as const, asset };
  }
}

export async function listInventoryLots(limit = 100) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }
  const admin = createServiceClient();
  const { data } = await admin
    .from("inventory_lots")
    .select("*")
    .order("purchased_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listTreasuryTrades(limit = 100) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }
  const admin = createServiceClient();
  const { data } = await admin
    .from("treasury_trades")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listReplenishments(limit = 50) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }
  const admin = createServiceClient();
  const { data } = await admin
    .from("replenishment_recommendations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getRiskBundle() {
  const dash = await getTreasuryDashboard("GOLD");
  if (!dash.connected) return dash;
  return {
    ...dash,
    assets: await Promise.all(
      TREASURY_ASSETS.map(async (asset) => {
        const price = await midPrice(asset);
        const position = await getTreasuryPosition(asset, price);
        return {
          asset,
          position,
          exposure: summarizeExposure(
            position,
            dash.risk.coverageCritical,
            dash.risk.coverageTarget
          ),
          scenarios: simulatePriceShock(position),
          previewRecommendation: recommendReplenishment({
            asset,
            physicalInventoryMg: position.physicalInventoryMg,
            customerLiabilityMg: position.customerLiabilityMg,
            settings: dash.risk,
          }),
        };
      })
    ),
  };
}

export async function ensureGoldReplenishmentSuggestion(actorId?: string) {
  const price = await midPrice("GOLD");
  return createReplenishmentRecommendation({
    asset: "GOLD",
    marketPriceTomanPerGram: price,
    actorId,
  });
}

export { formatBuyRecommendation };
