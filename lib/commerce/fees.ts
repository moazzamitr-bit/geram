import {
  DEFAULT_COMMERCE_SETTINGS,
  type CommerceSettings,
  type FeeSettings,
} from "@/lib/commerce/types";

export type PlanTier = "free" | "plus";

export function isPlusActive(
  tier: PlanTier,
  expiresAt: string | null | undefined
): boolean {
  if (tier !== "plus") return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export function buyTradeFee(
  amountToman: number,
  plus: boolean,
  fees: FeeSettings = DEFAULT_COMMERCE_SETTINGS.fees
): number {
  const pct = plus ? fees.buyFeePercentPlus : fees.buyFeePercentFree;
  const min = plus ? fees.buyFeeMinTomanPlus : fees.buyFeeMinTomanFree;
  return Math.max(min, Math.floor(amountToman * pct));
}

export function sellTradeFee(
  grossToman: number,
  plus: boolean,
  fees: FeeSettings = DEFAULT_COMMERCE_SETTINGS.fees
): number {
  const pct = plus ? fees.sellFeePercentPlus : fees.sellFeePercentFree;
  const min = plus ? fees.sellFeeMinTomanPlus : fees.sellFeeMinTomanFree;
  return Math.max(min, Math.floor(grossToman * pct));
}

export function withdrawFee(
  plus: boolean,
  fees: FeeSettings = DEFAULT_COMMERCE_SETTINGS.fees
): number {
  return plus ? fees.withdrawFeeTomanPlus : fees.withdrawFeeTomanFree;
}

export function dcaExecutionFee(
  plus: boolean,
  fees: FeeSettings = DEFAULT_COMMERCE_SETTINGS.fees
): number {
  return plus ? fees.dcaFeeTomanPlus : fees.dcaFeeTomanFree;
}

export function buyQuote(
  amountToman: number,
  pricePerGram: number,
  plus: boolean,
  settings: CommerceSettings = DEFAULT_COMMERCE_SETTINGS
) {
  const fee = buyTradeFee(amountToman, plus, settings.fees);
  const net = Math.max(0, amountToman - fee);
  const goldMg =
    pricePerGram > 0 ? Math.floor((net / pricePerGram) * 1000) : 0;
  return { fee, net, goldMg, pricePerGram };
}

export function sellQuote(
  goldMg: number,
  pricePerGram: number,
  plus: boolean,
  settings: CommerceSettings = DEFAULT_COMMERCE_SETTINGS
) {
  const gross = Math.floor((goldMg / 1000) * pricePerGram);
  const fee = sellTradeFee(gross, plus, settings.fees);
  const net = Math.max(0, gross - fee);
  return { gross, fee, net };
}
