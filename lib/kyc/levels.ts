import type { LimitSettings } from "@/lib/commerce/types";

/**
 * Levels modeled on Wallgold and Gerami.
 *
 * 0 — mobile OTP only.
 * 1 — national code + Jalali birth date matched by Shahkar and the civil registry.
 * 2 — plus at least one bank card owned by that national code. Required for
 *     quotes, trades, deposits and withdrawals.
 */
export type KycLevel = 0 | 1 | 2;

export const KYC_LEVEL_CAPS: Record<
  KycLevel,
  { dailyBuyToman: number; dailySellToman: number; dailyWithdrawToman: number }
> = {
  0: { dailyBuyToman: 0, dailySellToman: 0, dailyWithdrawToman: 0 },
  1: { dailyBuyToman: 0, dailySellToman: 0, dailyWithdrawToman: 0 },
  2: { dailyBuyToman: 1_000_000_000, dailySellToman: 500_000_000, dailyWithdrawToman: 50_000_000 },
};

export const KYC_LEVEL_TITLES: Record<KycLevel, string> = {
  0: "شماره موبایل",
  1: "اطلاعات هویتی",
  2: "کارت بانکی",
};

export function resolveKycLevel(state: { identity: boolean; card: boolean }): KycLevel {
  if (state.identity && state.card) return 2;
  if (state.identity) return 1;
  return 0;
}

/** Tighter of the admin setting and the level cap. A setting of 0 means "no admin cap". */
export function tightenCap(setting: number, levelCap: number) {
  if (levelCap <= 0) return 0;
  if (setting <= 0) return levelCap;
  return Math.min(setting, levelCap);
}

export function effectiveTradeLimits(settings: LimitSettings, level: KycLevel): LimitSettings {
  const cap = KYC_LEVEL_CAPS[level];
  return {
    dailyBuyToman: tightenCap(settings.dailyBuyToman, cap.dailyBuyToman),
    dailySellToman: tightenCap(settings.dailySellToman, cap.dailySellToman),
    dailyWithdrawToman: tightenCap(settings.dailyWithdrawToman, cap.dailyWithdrawToman),
  };
}
