export type FeeSettings = {
  buyFeePercentFree: number;
  buyFeeMinTomanFree: number;
  buyFeePercentPlus: number;
  buyFeeMinTomanPlus: number;
  sellFeePercentFree: number;
  sellFeeMinTomanFree: number;
  sellFeePercentPlus: number;
  sellFeeMinTomanPlus: number;
  withdrawFeeTomanFree: number;
  withdrawFeeTomanPlus: number;
};

export type PlusSettings = {
  monthlyPriceToman: number;
  maxDcaFree: number;
  maxDcaPlus: number;
  smsAlertsPlusOnly: boolean;
};

export type ReferralSettings = {
  /** Share of each invitee's trade fees credited to the inviter (Gerami model). */
  feeSharePercent: number;
};

/** Per-user daily caps, shown to users like Milli's limits sheet. */
export type LimitSettings = {
  dailyBuyToman: number;
  dailySellToman: number;
  dailyWithdrawToman: number;
};

export type CommerceSettings = {
  fees: FeeSettings;
  plus: PlusSettings;
  referral: ReferralSettings;
  limits: LimitSettings;
};

export const DEFAULT_COMMERCE_SETTINGS: CommerceSettings = {
  fees: {
    // Competitive with Wallgold/Gerami (~0.5%, no punitive floor): a fixed
    // minimum fee made small tickets cost 10–50%.
    buyFeePercentFree: 0.005,
    buyFeeMinTomanFree: 0,
    buyFeePercentPlus: 0.0035,
    buyFeeMinTomanPlus: 0,
    sellFeePercentFree: 0.005,
    sellFeeMinTomanFree: 0,
    sellFeePercentPlus: 0.0035,
    sellFeeMinTomanPlus: 0,
    // Competitors don't charge for withdrawals or scheduled buys beyond the trade fee.
    withdrawFeeTomanFree: 0,
    withdrawFeeTomanPlus: 0,
  },
  plus: {
    monthlyPriceToman: 49_000,
    maxDcaFree: 3,
    maxDcaPlus: 10,
    smsAlertsPlusOnly: true,
  },
  referral: {
    feeSharePercent: 0.15,
  },
  limits: {
    dailyBuyToman: 1_000_000_000,
    dailySellToman: 500_000_000,
    dailyWithdrawToman: 50_000_000,
  },
};
