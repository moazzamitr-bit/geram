import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";

export const physicalSettingsSchema = z.object({
  /** Service fee as a share of the delivered weight, charged in metal (Gerami: ~1%). */
  feePercent: z.number().min(0).max(0.2),
  branches: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        name: z.string().min(2).max(120),
        address: z.string().min(2).max(400),
        hours: z.string().max(200),
      })
    )
    .min(1)
    .max(20),
  slots: z.array(z.string().min(1).max(40)).min(1).max(12),
  /** Earliest pickup is today + minLeadDays. */
  minLeadDays: z.number().int().min(0).max(30),
});

export type PhysicalSettings = z.infer<typeof physicalSettingsSchema>;

export const DEFAULT_PHYSICAL_SETTINGS: PhysicalSettings = {
  feePercent: 0.01,
  branches: [
    {
      id: "tehran",
      name: "دفتر مرکزی گرم - تهران",
      address: "آدرس دقیق پس از تأیید درخواست پیامک می‌شود",
      hours: "شنبه تا چهارشنبه ۱۰ تا ۱۷",
    },
  ],
  slots: ["۱۰ تا ۱۲", "۱۲ تا ۱۴", "۱۴ تا ۱۷"],
  minLeadDays: 1,
};

export async function loadPhysicalSettings(): Promise<PhysicalSettings> {
  try {
    const db = createServiceClient();
    const { data } = await db.from("platform_settings").select("value").eq("key", "physical").maybeSingle();
    const parsed = physicalSettingsSchema.safeParse({ ...DEFAULT_PHYSICAL_SETTINGS, ...(data?.value ?? {}) });
    if (parsed.success) return parsed.data;
  } catch {
    /* defaults */
  }
  return DEFAULT_PHYSICAL_SETTINGS;
}

export async function savePhysicalSettings(value: PhysicalSettings) {
  const db = createServiceClient();
  const { error } = await db
    .from("platform_settings")
    .upsert({ key: "physical", value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
