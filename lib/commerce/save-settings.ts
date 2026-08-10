import { z } from "zod";
import {
  DEFAULT_COMMERCE_SETTINGS,
  type CommerceSettings,
} from "@/lib/commerce/types";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const feeSchema = z.object({
  buyFeePercentFree: z.number().min(0).max(0.2),
  buyFeeMinTomanFree: z.number().int().min(0).max(10_000_000),
  buyFeePercentPlus: z.number().min(0).max(0.2),
  buyFeeMinTomanPlus: z.number().int().min(0).max(10_000_000),
  sellFeePercentFree: z.number().min(0).max(0.2),
  sellFeeMinTomanFree: z.number().int().min(0).max(10_000_000),
  sellFeePercentPlus: z.number().min(0).max(0.2),
  sellFeeMinTomanPlus: z.number().int().min(0).max(10_000_000),
  withdrawFeeTomanFree: z.number().int().min(0).max(10_000_000),
  withdrawFeeTomanPlus: z.number().int().min(0).max(10_000_000),
  dcaFeeTomanFree: z.number().int().min(0).max(10_000_000),
  dcaFeeTomanPlus: z.number().int().min(0).max(10_000_000),
});

const plusSchema = z.object({
  monthlyPriceToman: z.number().int().min(0).max(100_000_000),
  maxDcaFree: z.number().int().min(0).max(100),
  maxDcaPlus: z.number().int().min(0).max(100),
  smsAlertsPlusOnly: z.boolean(),
});

const referralSchema = z.object({
  inviterBonusToman: z.number().int().min(0).max(100_000_000),
  inviteeBonusToman: z.number().int().min(0).max(100_000_000),
  minKycForPayout: z.boolean(),
});

export const commerceSettingsSchema = z.object({
  fees: feeSchema,
  plus: plusSchema,
  referral: referralSchema,
});

export function parseCommerceSettings(input: unknown): CommerceSettings {
  return commerceSettingsSchema.parse(input);
}

export async function saveCommerceSettings(
  input: CommerceSettings
): Promise<CommerceSettings> {
  const settings = parseCommerceSettings(input);
  const rows = [
    { key: "fees", value: settings.fees, updated_at: new Date().toISOString() },
    { key: "plus", value: settings.plus, updated_at: new Date().toISOString() },
    {
      key: "referral",
      value: settings.referral,
      updated_at: new Date().toISOString(),
    },
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
  partial: Partial<CommerceSettings> | null | undefined
): CommerceSettings {
  if (!partial) return DEFAULT_COMMERCE_SETTINGS;
  return {
    fees: { ...DEFAULT_COMMERCE_SETTINGS.fees, ...(partial.fees ?? {}) },
    plus: { ...DEFAULT_COMMERCE_SETTINGS.plus, ...(partial.plus ?? {}) },
    referral: {
      ...DEFAULT_COMMERCE_SETTINGS.referral,
      ...(partial.referral ?? {}),
    },
  };
}
