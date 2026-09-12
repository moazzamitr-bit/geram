import type {
  TreasuryAsset,
  TreasuryPosition,
  WacPool,
} from "@/lib/treasury/types";
import { wacPerGram, wacPerMg } from "@/lib/treasury/wac";

/**
 * Customer Liability = sum of customer-owned metal (mg).
 * Available = Physical - Liability - Reserved
 * Coverage = Physical / Liability (null if liability is 0)
 * Net metal position = Physical - Liability
 */
export function computePosition(input: {
  asset: TreasuryAsset;
  physicalInventoryMg: number;
  customerLiabilityMg: number;
  reservedInventoryMg: number;
  pool: WacPool;
  marketPriceTomanPerGram: number;
}): TreasuryPosition {
  const physical = Math.max(0, Math.floor(input.physicalInventoryMg));
  const liability = Math.max(0, Math.floor(input.customerLiabilityMg));
  const reserved = Math.max(0, Math.floor(input.reservedInventoryMg));
  const available = physical - liability - reserved;
  const coverageRatio = liability > 0 ? physical / liability : null;
  const book = Math.max(0, Math.floor(input.pool.totalCostToman));
  const marketValue = Math.floor(
    (physical / 1000) * Math.max(0, input.marketPriceTomanPerGram)
  );

  return {
    asset: input.asset,
    physicalInventoryMg: physical,
    customerLiabilityMg: liability,
    reservedInventoryMg: reserved,
    availableInventoryMg: available,
    coverageRatio,
    netMetalPositionMg: physical - liability,
    wacTomanPerMg: wacPerMg(input.pool),
    wacTomanPerGram: wacPerGram(input.pool),
    marketPriceTomanPerGram: input.marketPriceTomanPerGram,
    inventoryMarketValueToman: marketValue,
    inventoryBookValueToman: book,
    unrealizedPnlToman: marketValue - book,
  };
}
