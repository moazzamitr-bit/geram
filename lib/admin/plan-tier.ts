export const PLAN_TIERS = ["free", "plus"] as const;
export type AdminPlanTier = (typeof PLAN_TIERS)[number];

export function parsePlanTier(raw: string): AdminPlanTier | null {
  const tier = raw.trim().toLowerCase();
  if (tier === "free" || tier === "plus") return tier;
  return null;
}

/**
 * Revoking Plus clears the expiry so the fee schedule stops treating the user
 * as Plus. Granting Plus leaves expiry empty, which stays active until an
 * admin sets the tier back to free.
 */
export function planTierPatch(tier: AdminPlanTier) {
  if (tier === "free") return { plan_tier: "free" as const, plan_expires_at: null };
  return { plan_tier: "plus" as const, plan_expires_at: null };
}
