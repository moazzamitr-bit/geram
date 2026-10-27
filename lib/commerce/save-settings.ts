import { z } from "zod";
import {
  DEFAULT_COMMERCE_SETTINGS,
  type CommerceSettings,
} from "@/lib/commerce/types";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const feeSchema = z.object({
  buyFeePercentFree: z.number().min(0).max(0.02),
  buyFeeMinTomanFree: z.number().int().min(0).max(10_000_000),
  buyFeePercentPlus: z.number().min(0).max(0.02),
  buyFeeMinTomanPlus: z.number().int().min(0).max(10_000_000),
  sellFeePercentFree: z.number().min(0).max(0.02),
  sellFeeMinTomanFree: z.number().int().min(0).max(10_000_000),
  sellFeePercentPlus: z.number().min(0).max(0.02),
  sellFeeMinTomanPlus: z.number().int().min(0).max(10_000_000),
  withdrawFeeTomanFree: z.number().int().min(0).max(10_000_000),
  withdrawFeeTomanPlus: z.number().int().min(0).max(10_000_000),
});

const plusSchema = z.object({
  monthlyPriceToman: z.number().int().min(0).max(100_000_000),
  maxDcaFree: z.number().int().min(0).max(100),
  maxDcaPlus: z.number().int().min(0).max(100),
  smsAlertsPlusOnly: z.boolean(),
});

const referralSchema = z.object({
  feeSharePercent: z.number().min(0).max(0.5),
});

const limitsSchema = z.object({
  dailyBuyToman: z.number().int().min(0).max(100_000_000_000),
  dailySellToman: z.number().int().min(0).max(100_000_000_000),
  dailyWithdrawToman: z.number().int().min(0).max(100_000_000_000),
});

const pricingSchema = z.object({
  goldBase: z.enum(["tgju_gold_irg18", "geram18"]),
  goldBuySpreadPercent: z.number().min(0).max(0.02),
  goldSellSpreadPercent: z.number().min(0).max(0.02),
});

export const commerceSettingsSchema = z.object({
  pricing: pricingSchema,
  fees: feeSchema,
  plus: plusSchema,
  referral: referralSchema,
  limits: limitsSchema,
});

export function parseCommerceSettings(input: unknown): CommerceSettings {
  return commerceSettingsSchema.parse(input);
}

export async function saveCommerceSettings(
  input: CommerceSettings
): Promise<CommerceSettings> {
  const settings = parseCommerceSettings(input);
  const rows = [
    { key: "pricing", value: settings.pricing, updated_at: new Date().toISOString() },
    { key: "fees", value: settings.fees, updated_at: new Date().toISOString() },
    { key: "plus", value: settings.plus, updated_at: new Date().toISOString() },
    {
      key: "referral",
      value: settings.referral,
      updated_at: new Date().toISOString(),
    },
    { key: "limits", value: settings.limits, updated_at: new Date().toISOString() },
  ];

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createServiceClient();
    const { error } = await admin.from("platform_settings").upsert(rows, {
      onConflict: "key",
    });
    if (error) throw new Error(error.message);
    return settings;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert(rows, {
    onConflict: "key",
  });
  if (error) throw new Error(error.message);
  return settings;
}

export function mergeWithDefaults(
  partial: Partial<CommerceSettings> | null | undefined,
  base: CommerceSettings = DEFAULT_COMMERCE_SETTINGS
): CommerceSettings {
  if (!partial) return base;
  return {
    pricing: { ...base.pricing, ...(partial.pricing ?? {}) },
    fees: { ...base.fees, ...(partial.fees ?? {}) },
    plus: { ...base.plus, ...(partial.plus ?? {}) },
    referral: { ...base.referral, ...(partial.referral ?? {}) },
    limits: { ...base.limits, ...(partial.limits ?? {}) },
  };
}
