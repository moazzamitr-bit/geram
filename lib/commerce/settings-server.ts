import {
  DEFAULT_COMMERCE_SETTINGS,
  type CommerceSettings,
} from "@/lib/commerce/types";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function loadCommerceSettings(): Promise<CommerceSettings> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createServiceClient();
      const { data } = await admin.from("platform_settings").select("key, value");
      if (data?.length) {
        return mergeSettings(data);
      }
    }
    const supabase = await createClient();
    const { data } = await supabase.from("platform_settings").select("key, value");
    if (data?.length) {
      return mergeSettings(data);
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_COMMERCE_SETTINGS;
}

function mergeSettings(rows: { key: string; value: unknown }[]): CommerceSettings {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    fees: { ...DEFAULT_COMMERCE_SETTINGS.fees, ...(map.fees as object) },
    plus: { ...DEFAULT_COMMERCE_SETTINGS.plus, ...(map.plus as object) },
    referral: {
      ...DEFAULT_COMMERCE_SETTINGS.referral,
      ...(map.referral as object),
    },
  };
}
