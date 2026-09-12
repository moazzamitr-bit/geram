/**
 * Platform P&L — spread and fees are revenue; inventory WAC is cost of metal sold.
 */

export type TradePnlInput = {
  side: "CUSTOMER_BUY" | "CUSTOMER_SELL";
  spreadRevenueToman: number;
  feeRevenueToman: number;
  /** Inventory book cost consumed (customer buy) or 0 on sell acquire */
  inventoryCostToman: number;
  /**
   * On customer sell: acquisition cost booked into inventory
   * (what platform paid the customer for metal) — not a P&L cost yet.
   */
  metalAcquisitionToman?: number;
};

export type TradePnlResult = {
  revenueToman: number;
  costToman: number;
  realizedPnlToman: number;
};

export function realizeTradePnl(input: TradePnlInput): TradePnlResult {
  const revenue =
    Math.max(0, input.spreadRevenueToman) + Math.max(0, input.feeRevenueToman);

  if (input.side === "CUSTOMER_BUY") {
    const cost = Math.max(0, input.inventoryCostToman);
    return {
      revenueToman: revenue,
      costToman: cost,
      realizedPnlToman: revenue - cost,
    };
  }

  // Customer sell: realize spread+fee now; metal sits on balance sheet at acquisition.
  return {
    revenueToman: revenue,
    costToman: 0,
    realizedPnlToman: revenue,
  };
}

export type PeriodPnl = {
  spreadRevenueToman: number;
  feeRevenueToman: number;
  inventoryCogsToman: number;
  operationalCostToman: number;
  realizedPnlToman: number;
  unrealizedPnlToman: number;
  inventoryValuationToman: number;
  inventoryBookToman: number;
};

export function aggregatePeriodPnl(input: {
  trades: {
    spreadRevenueToman: number;
    feeRevenueToman: number;
    inventoryCostToman: number;
    realizedPnlToman: number;
  }[];
  operationalCostToman: number;
  inventoryMarketValueToman: number;
  inventoryBookValueToman: number;
}): PeriodPnl {
  const spreadRevenueToman = input.trades.reduce(
    (s, t) => s + t.spreadRevenueToman,
    0
  );
  const feeRevenueToman = input.trades.reduce((s, t) => s + t.feeRevenueToman, 0);
  const inventoryCogsToman = input.trades.reduce(
    (s, t) => s + t.inventoryCostToman,
    0
  );
  const realizedFromTrades = input.trades.reduce(
    (s, t) => s + t.realizedPnlToman,
    0
  );
  const operationalCostToman = Math.max(0, input.operationalCostToman);
  return {
    spreadRevenueToman,
    feeRevenueToman,
    inventoryCogsToman,
    operationalCostToman,
    realizedPnlToman: realizedFromTrades - operationalCostToman,
    unrealizedPnlToman:
      input.inventoryMarketValueToman - input.inventoryBookValueToman,
    inventoryValuationToman: input.inventoryMarketValueToman,
    inventoryBookToman: input.inventoryBookValueToman,
  };
}
