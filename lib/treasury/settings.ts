import {
  DEFAULT_SPREAD_SETTINGS,
  DEFAULT_TREASURY_RISK_SETTINGS,
  type SpreadSettings,
  type TreasuryRiskSettings,
  type TreasuryAsset,
} from "@/lib/treasury/types";
import { createServiceClient } from "@/lib/supabase/admin";

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function mergeSpreadSettings(raw: unknown): SpreadSettings {
  const o = asObject(raw);
  const assetsIn = asObject(o.assets);
  const base = DEFAULT_SPREAD_SETTINGS;
  const mergeAsset = (key: TreasuryAsset) => {
    const a = asObject(assetsIn[key]);
    return {
      buySpreadBps: Number(a.buySpreadBps ?? base.assets[key].buySpreadBps),
      sellSpreadBps: Number(a.sellSpreadBps ?? base.assets[key].sellSpreadBps),
    };
  };
  return {
    defaultBuySpreadBps: Number(o.defaultBuySpreadBps ?? base.defaultBuySpreadBps),
    defaultSellSpreadBps: Number(
      o.defaultSellSpreadBps ?? base.defaultSellSpreadBps
    ),
    emergencyMultiplier: Number(
      o.emergencyMultiplier ?? base.emergencyMultiplier
    ),
    assets: {
      GOLD: mergeAsset("GOLD"),
      SILVER: mergeAsset("SILVER"),
      COPPER: mergeAsset("COPPER"),
    },
    volatilityHighBpsAdd: Number(
      o.volatilityHighBpsAdd ?? base.volatilityHighBpsAdd
    ),
    liquidityLowBpsAdd: Number(o.liquidityLowBpsAdd ?? base.liquidityLowBpsAdd),
    shortageCoverageThreshold: Number(
      o.shortageCoverageThreshold ?? base.shortageCoverageThreshold
    ),
    shortageBpsAdd: Number(o.shortageBpsAdd ?? base.shortageBpsAdd),
  };
}

export function mergeTreasuryRiskSettings(raw: unknown): TreasuryRiskSettings {
  const o = asObject(raw);
  const enabled = Array.isArray(o.assetsEnabled)
    ? (o.assetsEnabled.filter((x) =>
        ["GOLD", "SILVER", "COPPER"].includes(String(x))
      ) as TreasuryAsset[])
    : DEFAULT_TREASURY_RISK_SETTINGS.assetsEnabled;
  return {
    coverageTarget: Number(
      o.coverageTarget ?? DEFAULT_TREASURY_RISK_SETTINGS.coverageTarget
    ),
    coverageCritical: Number(
      o.coverageCritical ?? DEFAULT_TREASURY_RISK_SETTINGS.coverageCritical
    ),
    replenishmentBufferRatio: Number(
      o.replenishmentBufferRatio ??
        DEFAULT_TREASURY_RISK_SETTINGS.replenishmentBufferRatio
    ),
    assetsEnabled: enabled.length
      ? enabled
      : DEFAULT_TREASURY_RISK_SETTINGS.assetsEnabled,
  };
}

export async function loadSpreadSettings(): Promise<SpreadSettings> {
  try {
    const admin = createServiceClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "spread")
      .maybeSingle();
    return mergeSpreadSettings(data?.value);
  } catch {
    return DEFAULT_SPREAD_SETTINGS;
  }
}

export async function loadTreasuryRiskSettings(): Promise<TreasuryRiskSettings> {
  try {
    const admin = createServiceClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "treasury")
      .maybeSingle();
    return mergeTreasuryRiskSettings(data?.value);
  } catch {
    return DEFAULT_TREASURY_RISK_SETTINGS;
  }
}

export async function saveSpreadSettings(
  settings: SpreadSettings,
  actorId?: string
): Promise<void> {
  const admin = createServiceClient();
  const { error } = await admin.from("platform_settings").upsert({
    key: "spread",
    value: settings,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await admin.from("treasury_audit_log").insert({
    action: "SPREAD_SETTINGS_UPDATE",
    entity_type: "platform_settings",
    entity_id: "spread",
    actor_id: actorId ?? null,
    payload: settings,
  });
}

export async function saveTreasuryRiskSettings(
  settings: TreasuryRiskSettings,
  actorId?: string
): Promise<void> {
  const admin = createServiceClient();
  const { error } = await admin.from("platform_settings").upsert({
    key: "treasury",
    value: settings,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await admin.from("treasury_audit_log").insert({
    action: "TREASURY_SETTINGS_UPDATE",
    entity_type: "platform_settings",
    entity_id: "treasury",
    actor_id: actorId ?? null,
    payload: settings,
  });
}
