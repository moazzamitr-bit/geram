import { feesFromCommercePercent } from "@/lib/core/engine";
import type { FeeSnapshot } from "@/lib/core/fees";
import { isPlusActive, type PlanTier } from "@/lib/commerce/fees";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { isSupabaseConfigured } from "@/lib/db/types";

/**
 * Fee schedule a quote must use for this user: the admin-edited commerce
 * settings at the user's current plan tier. Returns undefined when Supabase is
 * not configured, so the engine falls back to its defaults (local sandbox).
 */
export async function resolveUserFeeSnapshot(userId: string): Promise<FeeSnapshot | undefined> {
  if (!isSupabaseConfigured()) return undefined;

  const settings = await loadCommerceSettings();
  let plus = false;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("plan_tier, plan_expires_at")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      plus = isPlusActive(data.plan_tier as PlanTier, data.plan_expires_at as string | null);
    }
  } catch {
    plus = false;
  }

  return feesFromCommercePercent({ plus, ...settings.fees });
}
