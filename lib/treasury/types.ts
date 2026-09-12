/** Precious-metal market-maker treasury types (asset-agnostic). */

export const TREASURY_ASSETS = ["GOLD", "SILVER", "COPPER"] as const;
export type TreasuryAsset = (typeof TREASURY_ASSETS)[number];

export function isTreasuryAsset(v: string): v is TreasuryAsset {
  return (TREASURY_ASSETS as readonly string[]).includes(v);
}

export type InventoryLotInput = {
  asset: TreasuryAsset;
  weightMg: number;
  acquisitionCostToman: number;
  supplier: string;
  purchasedAt?: string;
};

export type InventoryLotState = InventoryLotInput & {
  id: string;
  remainingMg: number;
  unitCostTomanPerMg: number;
  status: "ACTIVE" | "DEPLETED" | "VOID";
};

export type MovementType =
  | "PURCHASE"
  | "CONSUME_CUSTOMER_BUY"
  | "ACQUIRE_CUSTOMER_SELL"
  | "RESERVE"
  | "RELEASE_RESERVE"
  | "VOID";

export type WacPool = {
  asset: TreasuryAsset;
  totalWeightMg: number;
  totalCostToman: number;
};

export type TreasuryPosition = {
  asset: TreasuryAsset;
  physicalInventoryMg: number;
  customerLiabilityMg: number;
  reservedInventoryMg: number;
  availableInventoryMg: number;
  coverageRatio: number | null;
  netMetalPositionMg: number;
  wacTomanPerMg: number;
  wacTomanPerGram: number;
  marketPriceTomanPerGram: number;
  inventoryMarketValueToman: number;
  inventoryBookValueToman: number;
  unrealizedPnlToman: number;
};

export type AssetSpreadConfig = {
  buySpreadBps: number;
  sellSpreadBps: number;
};

export type SpreadSettings = {
  defaultBuySpreadBps: number;
  defaultSellSpreadBps: number;
  emergencyMultiplier: number;
  assets: Record<TreasuryAsset, AssetSpreadConfig>;
  volatilityHighBpsAdd: number;
  liquidityLowBpsAdd: number;
  shortageCoverageThreshold: number;
  shortageBpsAdd: number;
};

export type SpreadContext = {
  volatilityHigh?: boolean;
  liquidityLow?: boolean;
  coverageRatio?: number | null;
};

export type SpreadQuote = {
  asset: TreasuryAsset;
  midPriceTomanPerGram: number;
  buySpreadBps: number;
  sellSpreadBps: number;
  customerBuyPriceTomanPerGram: number;
  customerSellPriceTomanPerGram: number;
};

export type TreasuryRiskSettings = {
  coverageTarget: number;
  coverageCritical: number;
  replenishmentBufferRatio: number;
  assetsEnabled: TreasuryAsset[];
};

export const DEFAULT_SPREAD_SETTINGS: SpreadSettings = {
  defaultBuySpreadBps: 50,
  defaultSellSpreadBps: 50,
  emergencyMultiplier: 1,
  assets: {
    GOLD: { buySpreadBps: 50, sellSpreadBps: 50 },
    SILVER: { buySpreadBps: 80, sellSpreadBps: 80 },
    COPPER: { buySpreadBps: 100, sellSpreadBps: 100 },
  },
  volatilityHighBpsAdd: 25,
  liquidityLowBpsAdd: 20,
  shortageCoverageThreshold: 1.05,
  shortageBpsAdd: 40,
};

export const DEFAULT_TREASURY_RISK_SETTINGS: TreasuryRiskSettings = {
  coverageTarget: 1.15,
  coverageCritical: 1.0,
  replenishmentBufferRatio: 0.2,
  assetsEnabled: ["GOLD", "SILVER", "COPPER"],
};

export function mgToGrams(mg: number): number {
  return mg / 1000;
}

export function gramsToMg(grams: number): number {
  return Math.floor(grams * 1000);
}
