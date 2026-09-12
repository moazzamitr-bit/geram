import {
  DEFAULT_SPREAD_SETTINGS,
  type SpreadContext,
  type SpreadQuote,
  type SpreadSettings,
  type TreasuryAsset,
} from "@/lib/treasury/types";

function clampBps(n: number): number {
  return Math.max(0, Math.floor(n));
}

export function resolveAssetSpreads(
  asset: TreasuryAsset,
  settings: SpreadSettings = DEFAULT_SPREAD_SETTINGS
): { buySpreadBps: number; sellSpreadBps: number } {
  const assetCfg = settings.assets[asset];
  return {
    buySpreadBps: clampBps(
      assetCfg?.buySpreadBps ?? settings.defaultBuySpreadBps
    ),
    sellSpreadBps: clampBps(
      assetCfg?.sellSpreadBps ?? settings.defaultSellSpreadBps
    ),
  };
}

/**
 * Dynamic spread — independent of commission/fees.
 * Adds bps for volatility, low liquidity, inventory shortage; applies emergency multiplier.
 */
export function computeEffectiveSpreads(
  asset: TreasuryAsset,
  settings: SpreadSettings = DEFAULT_SPREAD_SETTINGS,
  ctx: SpreadContext = {}
): { buySpreadBps: number; sellSpreadBps: number } {
  const base = resolveAssetSpreads(asset, settings);
  let add = 0;
  if (ctx.volatilityHigh) add += settings.volatilityHighBpsAdd;
  if (ctx.liquidityLow) add += settings.liquidityLowBpsAdd;
  if (
    ctx.coverageRatio != null &&
    ctx.coverageRatio < settings.shortageCoverageThreshold
  ) {
    add += settings.shortageBpsAdd;
  }

  const mult = Math.max(1, settings.emergencyMultiplier || 1);
  return {
    buySpreadBps: clampBps((base.buySpreadBps + add) * mult),
    sellSpreadBps: clampBps((base.sellSpreadBps + add) * mult),
  };
}

/** Apply buy/sell spread to mid. Commission must stay separate. */
export function quoteWithSpread(
  asset: TreasuryAsset,
  midPriceTomanPerGram: number,
  settings: SpreadSettings = DEFAULT_SPREAD_SETTINGS,
  ctx: SpreadContext = {}
): SpreadQuote {
  if (midPriceTomanPerGram <= 0) throw new Error("invalid_mid_price");
  const { buySpreadBps, sellSpreadBps } = computeEffectiveSpreads(
    asset,
    settings,
    ctx
  );
  const buy = Math.floor(midPriceTomanPerGram * (1 + buySpreadBps / 10_000));
  const sell = Math.floor(midPriceTomanPerGram * (1 - sellSpreadBps / 10_000));
  return {
    asset,
    midPriceTomanPerGram,
    buySpreadBps,
    sellSpreadBps,
    customerBuyPriceTomanPerGram: Math.max(buy, 1),
    customerSellPriceTomanPerGram: Math.max(sell, 1),
  };
}

/** Spread revenue on customer buy: they pay above mid. */
export function spreadRevenueCustomerBuy(
  weightMg: number,
  midPerGram: number,
  customerBuyPerGram: number
): number {
  const grossMid = Math.floor((weightMg / 1000) * midPerGram);
  const grossCustomer = Math.floor((weightMg / 1000) * customerBuyPerGram);
  return Math.max(0, grossCustomer - grossMid);
}

/** Spread revenue on customer sell: platform buys below mid. */
export function spreadRevenueCustomerSell(
  weightMg: number,
  midPerGram: number,
  customerSellPerGram: number
): number {
  const grossMid = Math.floor((weightMg / 1000) * midPerGram);
  const grossCustomer = Math.floor((weightMg / 1000) * customerSellPerGram);
  return Math.max(0, grossMid - grossCustomer);
}
