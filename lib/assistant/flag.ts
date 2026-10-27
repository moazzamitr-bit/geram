import { createServiceClient } from "@/lib/supabase/admin";

/** Feature switches stored in core_kill_switches that default to OFF when no row exists. */
export const FEATURE_SWITCH_KEYS = ["AI_ASSISTANT_ENABLED"] as const;
export type FeatureSwitchKey = (typeof FEATURE_SWITCH_KEYS)[number];

let cached: { value: boolean; at: number } | null = null;

export async function assistantEnabled(): Promise<boolean> {
  if (cached && Date.now() - cached.at < 15_000) return cached.value;
  let value = false;
  try {
    const { data } = await createServiceClient()
      .from("core_kill_switches")
      .select("enabled")
      .eq("key", "AI_ASSISTANT_ENABLED")
      .maybeSingle();
    value = data?.enabled === true;
  } catch {
    value = false;
  }
  cached = { value, at: Date.now() };
  return value;
}
