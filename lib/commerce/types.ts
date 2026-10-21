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
  dcaFeeTomanFree: number;
  dcaFeeTomanPlus: number;
};

export type PlusSettings = {
  monthlyPriceToman: number;
  maxDcaFree: number;
  maxDcaPlus: number;
  smsAlertsPlusOnly: boolean;
};

export type ReferralSettings = {
  inviterBonusToman: number;
  inviteeBonusToman: number;
  minKycForPayout: boolean;
};

export type CommerceSettings = {
  fees: FeeSettings;
  plus: PlusSettings;
  referral: ReferralSettings;
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
    withdrawFeeTomanFree: 15_000,
    withdrawFeeTomanPlus: 0,
    dcaFeeTomanFree: 25_000,
    dcaFeeTomanPlus: 10_000,
  },
  plus: {
    monthlyPriceToman: 99_000,
    maxDcaFree: 1,
    maxDcaPlus: 10,
    smsAlertsPlusOnly: true,
  },
  referral: {
    inviterBonusToman: 100_000,
    inviteeBonusToman: 50_000,
    minKycForPayout: true,
  },
};
