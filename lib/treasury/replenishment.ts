import {
  DEFAULT_TREASURY_RISK_SETTINGS,
  type TreasuryAsset,
  type TreasuryRiskSettings,
} from "@/lib/treasury/types";

export type ReplenishmentRecommendation = {
  asset: TreasuryAsset;
  recommendedWeightMg: number;
  reason: string;
  coverageBefore: number | null;
  coverageTarget: number;
};

/**
 * Never auto-buys. Returns a recommendation when coverage is below target.
 * Target physical = liability * coverageTarget * (1 + buffer)
 */
export function recommendReplenishment(input: {
  asset: TreasuryAsset;
  physicalInventoryMg: number;
  customerLiabilityMg: number;
  marketPriceTomanPerGram?: number;
  settings?: TreasuryRiskSettings;
}): ReplenishmentRecommendation | null {
  const settings = input.settings ?? DEFAULT_TREASURY_RISK_SETTINGS;
  const liability = Math.max(0, input.customerLiabilityMg);
  const physical = Math.max(0, input.physicalInventoryMg);
  const coverageBefore = liability > 0 ? physical / liability : null;

  if (liability <= 0) return null;
  if (coverageBefore != null && coverageBefore >= settings.coverageTarget) {
    return null;
  }

  const targetPhysical = Math.ceil(
    liability *
      settings.coverageTarget *
      (1 + settings.replenishmentBufferRatio)
  );
  const recommendedWeightMg = Math.max(0, targetPhysical - physical);
  if (recommendedWeightMg <= 0) return null;

  const reason =
    coverageBefore != null && coverageBefore < settings.coverageCritical
      ? `Coverage critical (${coverageBefore.toFixed(3)} < ${settings.coverageCritical}). Replenish ${input.asset}.`
      : `Coverage below target (${(coverageBefore ?? 0).toFixed(3)} < ${settings.coverageTarget}). Replenish ${input.asset}.`;

  return {
    asset: input.asset,
    recommendedWeightMg,
    reason,
    coverageBefore,
    coverageTarget: settings.coverageTarget,
  };
}

/** Format helper for admin copy e.g. BUY 50kg GOLD */
export function formatBuyRecommendation(rec: {
  asset: string;
  recommendedWeightMg: number;
  reason?: string;
  coverageBefore?: number | null;
  coverageTarget?: number;
}): string {
  const kg = rec.recommendedWeightMg / 1_000_000;
  const label =
    kg >= 1
      ? `${kg.toLocaleString("en-US", { maximumFractionDigits: 3 })}kg`
      : `${(rec.recommendedWeightMg / 1000).toLocaleString("en-US", {
          maximumFractionDigits: 3,
        })}g`;
  return `BUY ${label} ${rec.asset}`;
}
