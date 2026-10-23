import { buyQuote, sellQuote } from "@/lib/commerce/fees";
import {
  DEFAULT_COMMERCE_SETTINGS,
  type CommerceSettings,
} from "@/lib/commerce/types";

export type TradeSide = "buy" | "sell";
export type AmountField = "toman" | "gram";

export function parseAmount(raw: string) {
  const latin = raw
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s,٬،]/g, "")
    .trim();
  if (!latin || latin === ".") return 0;
  const value = Number(latin);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function formatGramInput(grams: number) {
  if (!Number.isFinite(grams) || grams <= 0) return "0";
  const rounded = Math.round(grams * 1000) / 1000;
  return String(rounded);
}

export function feeRate(
  side: TradeSide,
  plus: boolean,
  settings: CommerceSettings = DEFAULT_COMMERCE_SETTINGS
) {
  const fees = settings.fees;
  if (side === "buy") return plus ? fees.buyFeePercentPlus : fees.buyFeePercentFree;
  return plus ? fees.sellFeePercentPlus : fees.sellFeePercentFree;
}

export function tomanForTargetBuyGrams(
  grams: number,
  pricePerGram: number,
  plus: boolean,
  settings: CommerceSettings = DEFAULT_COMMERCE_SETTINGS
) {
  if (grams <= 0 || pricePerGram <= 0) return 0;
  const pct = feeRate("buy", plus, settings);
  let toman = pct >= 1 ? Math.ceil(grams * pricePerGram) : Math.ceil((grams * pricePerGram) / (1 - pct));
  for (let i = 0; i < 6; i++) {
    const quote = buyQuote(toman, pricePerGram, plus, settings);
    const got = quote.goldMg / 1000;
    if (got <= 0) {
      toman += Math.ceil(pricePerGram);
      continue;
    }
    if (Math.abs(got - grams) / grams < 0.01) break;
    toman = Math.max(1, Math.round(toman * (grams / got)));
  }
  return toman;
}

export function gramsForTargetSellNet(
  targetNet: number,
  pricePerGram: number,
  plus: boolean,
  settings: CommerceSettings = DEFAULT_COMMERCE_SETTINGS
) {
  if (targetNet <= 0 || pricePerGram <= 0) return 0;
  const pct = feeRate("sell", plus, settings);
  let grams = pct >= 1 ? targetNet / pricePerGram : targetNet / (pricePerGram * (1 - pct));
  for (let i = 0; i < 6; i++) {
    const quote = sellQuote(Math.max(0, Math.round(grams * 1000)), pricePerGram, plus, settings);
    if (quote.net <= 0) break;
    const ratio = targetNet / quote.net;
    if (Math.abs(ratio - 1) < 0.002) break;
    grams *= ratio;
  }
  return grams;
}

export function quotePreview(input: {
  side: TradeSide;
  edited: AmountField;
  toman: number;
  grams: number;
  pricePerGram: number;
  plus: boolean;
  settings?: CommerceSettings;
}) {
  const settings = input.settings ?? DEFAULT_COMMERCE_SETTINGS;
  const price = input.pricePerGram;
  if (price <= 0) {
    return {
      toman: input.edited === "toman" ? Math.round(Math.max(0, input.toman)) : 0,
      grams: input.edited === "gram" ? Math.max(0, input.grams) : 0,
      fee: 0,
      goldMg: input.edited === "gram" ? Math.round(Math.max(0, input.grams) * 1000) : 0,
      net: 0,
    };
  }

  if (input.side === "buy") {
    const toman =
      input.edited === "toman"
        ? Math.round(Math.max(0, input.toman))
        : tomanForTargetBuyGrams(input.grams, price, input.plus, settings);
    const quote = buyQuote(toman, price, input.plus, settings);
    return {
      toman,
      grams: quote.goldMg / 1000,
      fee: quote.fee,
      goldMg: quote.goldMg,
      net: quote.net,
    };
  }

  const grams =
    input.edited === "gram"
      ? Math.max(0, input.grams)
      : gramsForTargetSellNet(input.toman, price, input.plus, settings);
  const goldMg = Math.round(grams * 1000);
  const quote = sellQuote(goldMg, price, input.plus, settings);
  return {
    toman: quote.net,
    grams: goldMg / 1000,
    fee: quote.fee,
    goldMg,
    net: quote.net,
  };
}
