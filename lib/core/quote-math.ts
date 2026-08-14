import { BPS_DENOM, mulDivCeil, mulDivFloor, type Irr, type Microgram } from "@/lib/core/money";
import { UG_PER_GRAM } from "@/lib/core/money";
import { feeOnAmount, type FeeSnapshot, type SpreadSnapshot } from "@/lib/core/fees";
import type { InputMode, QuoteSide } from "@/lib/core/types";
import { CoreError } from "@/lib/core/types";

export type QuoteComputation = {
  executionPriceIrrPerGram: Irr;
  grossIrr: Irr;
  feeIrr: Irr;
  netIrr: Irr;
  weightUg: Microgram;
};

export function applySpread(
  reference: Irr,
  side: QuoteSide,
  spread: SpreadSnapshot
): Irr {
  const bps = side === "BUY" ? spread.buySpreadBps : spread.sellSpreadBps;
  if (bps === 0n) return reference;
  if (side === "BUY") {
    return reference + mulDivFloor(reference, bps, BPS_DENOM);
  }
  const discounted = reference - mulDivFloor(reference, bps, BPS_DENOM);
  if (discounted <= 0n) throw new CoreError("invalid_price", "spread wiped price");
  return discounted;
}

/**
 * Conservative rounding:
 * BUY + Rial: metal floor so cost cannot exceed budget
 * BUY + weight: rial ceil
 * SELL + weight: proceeds floor
 * SELL + Rial target: metal ceil
 */
export function computeQuote(input: {
  side: QuoteSide;
  inputMode: InputMode;
  requestedIrr: Irr;
  requestedWeightUg: Microgram;
  executionPriceIrrPerGram: Irr;
  fees: FeeSnapshot;
}): QuoteComputation {
  const price = input.executionPriceIrrPerGram;
  if (price <= 0n) throw new CoreError("invalid_price", "execution price must be > 0");

  if (input.side === "BUY" && input.inputMode === "RIAL_AMOUNT") {
    const gross = input.requestedIrr;
    if (gross <= 0n) throw new CoreError("invalid_amount", "buy amount must be > 0");
    const fee = feeOnAmount(gross, input.fees.buyFeeBps, input.fees.buyFeeMinIrr);
    const net = gross - fee;
    if (net <= 0n) throw new CoreError("invalid_amount", "amount after fee is not positive");
    const weightUg = mulDivFloor(net, UG_PER_GRAM, price);
    if (weightUg <= 0n) throw new CoreError("invalid_amount", "amount too small for 1 µg");
    return { executionPriceIrrPerGram: price, grossIrr: gross, feeIrr: fee, netIrr: net, weightUg };
  }

  if (input.side === "BUY" && input.inputMode === "METAL_WEIGHT") {
    const weightUg = input.requestedWeightUg;
    if (weightUg <= 0n) throw new CoreError("invalid_amount", "weight must be > 0");
    const metalCost = mulDivCeil(weightUg, price, UG_PER_GRAM);
    const fee = feeOnAmount(metalCost, input.fees.buyFeeBps, input.fees.buyFeeMinIrr);
    const gross = metalCost + fee;
    return {
      executionPriceIrrPerGram: price,
      grossIrr: gross,
      feeIrr: fee,
      netIrr: metalCost,
      weightUg,
    };
  }

  if (input.side === "SELL" && input.inputMode === "METAL_WEIGHT") {
    const weightUg = input.requestedWeightUg;
    if (weightUg <= 0n) throw new CoreError("invalid_amount", "weight must be > 0");
    const gross = mulDivFloor(weightUg, price, UG_PER_GRAM);
    if (gross <= 0n) throw new CoreError("invalid_amount", "weight too small");
    const fee = feeOnAmount(gross, input.fees.sellFeeBps, input.fees.sellFeeMinIrr);
    const net = gross - fee;
    if (net <= 0n) throw new CoreError("invalid_amount", "proceeds after fee not positive");
    return { executionPriceIrrPerGram: price, grossIrr: gross, feeIrr: fee, netIrr: net, weightUg };
  }

  // SELL + RIAL_AMOUNT: user wants at least requestedIrr net proceeds
  const targetNet = input.requestedIrr;
  if (targetNet <= 0n) throw new CoreError("invalid_amount", "target rial must be > 0");
  const bps = input.fees.sellFeeBps;
  const minFee = input.fees.sellFeeMinIrr;
  // gross - max(minFee, gross*bps/10000) >= target
  let gross: Irr;
  if (bps >= BPS_DENOM) throw new CoreError("invalid_fee", "fee bps too high");
  const algebra = mulDivCeil(targetNet, BPS_DENOM, BPS_DENOM - bps);
  gross = algebra > targetNet + minFee ? algebra : targetNet + minFee;
  // bump until constraint holds
  for (let i = 0; i < 8; i++) {
    const fee = feeOnAmount(gross, bps, minFee);
    if (gross - fee >= targetNet) break;
    gross += 1n;
  }
  const fee = feeOnAmount(gross, bps, minFee);
  const net = gross - fee;
  const weightUg = mulDivCeil(gross, UG_PER_GRAM, price);
  return { executionPriceIrrPerGram: price, grossIrr: gross, feeIrr: fee, netIrr: net, weightUg };
}
