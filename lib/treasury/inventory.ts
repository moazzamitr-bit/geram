import type { InventoryLotState, TreasuryAsset } from "@/lib/treasury/types";
import { unitCostPerMg } from "@/lib/treasury/wac";

export function createLotState(
  id: string,
  input: {
    asset: TreasuryAsset;
    weightMg: number;
    acquisitionCostToman: number;
    supplier: string;
    purchasedAt?: string;
  }
): InventoryLotState {
  if (input.weightMg <= 0) throw new Error("invalid_lot_weight");
  if (input.acquisitionCostToman < 0) throw new Error("invalid_lot_cost");
  return {
    id,
    asset: input.asset,
    weightMg: input.weightMg,
    remainingMg: input.weightMg,
    acquisitionCostToman: input.acquisitionCostToman,
    unitCostTomanPerMg: unitCostPerMg(
      input.weightMg,
      input.acquisitionCostToman
    ),
    supplier: input.supplier,
    purchasedAt: input.purchasedAt,
    status: "ACTIVE",
  };
}

/**
 * FIFO partial consumption across lots (physical tracking).
 * Does not decide P&L cost — WAC engine owns cost.
 */
export function consumeLotsFifo(
  lots: InventoryLotState[],
  asset: TreasuryAsset,
  weightMg: number
): {
  lots: InventoryLotState[];
  consumptions: { lotId: string; weightMg: number }[];
} {
  if (weightMg <= 0) throw new Error("invalid_consume_weight");
  const active = lots
    .filter((l) => l.asset === asset && l.status === "ACTIVE" && l.remainingMg > 0)
    .sort((a, b) =>
      String(a.purchasedAt ?? "").localeCompare(String(b.purchasedAt ?? ""))
    );

  const available = active.reduce((s, l) => s + l.remainingMg, 0);
  if (available < weightMg) throw new Error("insufficient_lot_inventory");

  let remaining = weightMg;
  const consumptions: { lotId: string; weightMg: number }[] = [];
  const byId = new Map(lots.map((l) => [l.id, { ...l }]));

  for (const lot of active) {
    if (remaining <= 0) break;
    const current = byId.get(lot.id)!;
    const take = Math.min(current.remainingMg, remaining);
    current.remainingMg -= take;
    if (current.remainingMg === 0) current.status = "DEPLETED";
    consumptions.push({ lotId: current.id, weightMg: take });
    remaining -= take;
    byId.set(current.id, current);
  }

  return { lots: Array.from(byId.values()), consumptions };
}

export function physicalFromLots(
  lots: InventoryLotState[],
  asset: TreasuryAsset
): number {
  return lots
    .filter((l) => l.asset === asset && l.status === "ACTIVE")
    .reduce((s, l) => s + l.remainingMg, 0);
}
