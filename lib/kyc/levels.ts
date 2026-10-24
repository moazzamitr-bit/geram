import type { LimitSettings } from "@/lib/commerce/types";

/**
 * Levels modeled on Wallgold and Gerami public flows.
 *
 * 0 — mobile OTP only. No national id yet.
 * 1 — national id + Jalali birth date, Shahkar match of that mobile, name from
 *     the civil registry. Unlocks trading up to the identity cap.
 * 2 — a card or IBAN owned by the same national id. Unlocks the higher cap
 *     and withdrawals. Wallgold requires this before card deposits; Gerami
 *     asks for an IBAN in the user's own name.
 */
export type KycLevel = 0 | 1 | 2;

export const KYC_LEVEL_CAPS: Record<
  KycLevel,
  { dailyBuyToman: number; dailySellToman: number; dailyWithdrawToman: number }
> = {
  0: { dailyBuyToman: 0, dailySellToman: 0, dailyWithdrawToman: 0 },
  // Wallgold's published per-purchase ceiling has been 200 million toman.
  1: { dailyBuyToman: 200_000_000, dailySellToman: 200_000_000, dailyWithdrawToman: 0 },
  // Default commerce caps, and the 50 million toman withdrawal figure Wallgold
  // has published as a daily cash-out ceiling.
  2: { dailyBuyToman: 1_000_000_000, dailySellToman: 500_000_000, dailyWithdrawToman: 50_000_000 },
};

export const KYC_LEVEL_TITLES: Record<KycLevel, string> = {
  0: "شماره موبایل",
  1: "هویت",
  2: "حساب بانکی",
};

export function resolveKycLevel(row: {
  kyc_status?: string | null;
  kyc_level?: number | null;
  kyc_bank_verified_at?: string | null;
}): KycLevel {
  if (row.kyc_bank_verified_at || row.kyc_level === 2) return 2;
  if (row.kyc_status === "VERIFIED" || row.kyc_level === 1) return 1;
  return 0;
}

/**
 * When KYC is required, the tighter of the admin setting and the level cap
 * applies. A setting of 0 means "no admin cap", so the level cap still holds.
 * Level 0 is already blocked from trading by the KYC gate.
 */
export function tightenCap(setting: number, levelCap: number) {
  if (levelCap <= 0) return 0;
  if (setting <= 0) return levelCap;
  return Math.min(setting, levelCap);
}

export function effectiveTradeLimits(
  settings: LimitSettings,
  level: KycLevel,
  kycRequired: boolean
): LimitSettings {
  if (!kycRequired) return settings;
  const cap = KYC_LEVEL_CAPS[level];
  return {
    dailyBuyToman: tightenCap(settings.dailyBuyToman, cap.dailyBuyToman),
    dailySellToman: tightenCap(settings.dailySellToman, cap.dailySellToman),
    dailyWithdrawToman: tightenCap(settings.dailyWithdrawToman, cap.dailyWithdrawToman),
  };
}
