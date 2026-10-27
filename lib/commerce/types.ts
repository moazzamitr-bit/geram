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

/** TGJU row that prices 18k gold. irg18 = the traded 18k gram price competitors anchor to. */
export type GoldBaseKey = "tgju_gold_irg18" | "geram18";
export const GOLD_BASE_KEYS: readonly GoldBaseKey[] = ["tgju_gold_irg18", "geram18"];

/** Price policy: base row + buy/sell spread over the guarded base (gold only; silver/copper have no spread). */
export type PricingSettings = {
  goldBase: GoldBaseKey;
  /** fraction, 0.003 = 0.3% — user buy price = base × (1 + this) */
  goldBuySpreadPercent: number;
  /** fraction — user sell price = base × (1 − this) */
  goldSellSpreadPercent: number;
};

export type CommerceSettings = {
  pricing: PricingSettings;
  fees: FeeSettings;
  plus: PlusSettings;
  referral: ReferralSettings;
  limits: LimitSettings;
};

export const DEFAULT_COMMERCE_SETTINGS: CommerceSettings = {
  // Approved 1405-08-05: base irg18, ±0.3% spread, 0.25% fee — near the competitor median.
  pricing: {
    goldBase: "tgju_gold_irg18",
    goldBuySpreadPercent: 0.003,
    goldSellSpreadPercent: 0.003,
  },
  fees: {
    // Competitive with Wallgold/Gerami (~0.5%, no punitive floor): a fixed
    // minimum fee made small tickets cost 10–50%.
    buyFeePercentFree: 0.0025,
    buyFeeMinTomanFree: 0,
    buyFeePercentPlus: 0.0025,
    buyFeeMinTomanPlus: 0,
    sellFeePercentFree: 0.0025,
    sellFeeMinTomanFree: 0,
    sellFeePercentPlus: 0.0025,
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
