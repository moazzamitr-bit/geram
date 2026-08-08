type TradeLike = {
  type: string;
  status: string;
  goldMg: number;
  pricePerGram: number;
};

/** Weighted average buy price (تومان / گرم) from completed buy trades. */
export function averageBuyPriceFromTrades(
  transactions: TradeLike[],
  fallbackPrice = 0
) {
  let totalMg = 0;
  let totalCost = 0;

  for (const tx of transactions) {
    if (tx.type !== "خرید") continue;
    if (tx.status === "ناموفق" || tx.status === "لغو شده") continue;
    if (tx.goldMg <= 0 || tx.pricePerGram <= 0) continue;
    totalMg += tx.goldMg;
    totalCost += (tx.goldMg / 1000) * tx.pricePerGram;
  }

  if (totalMg <= 0) return fallbackPrice;
  return Math.round(totalCost / (totalMg / 1000));
}

/** New average after adding `boughtMg` at `buyPricePerGram`. */
export function nextAverageBuyPrice(input: {
  prevGoldMg: number;
  prevAvg: number;
  boughtMg: number;
  buyPricePerGram: number;
}) {
  const { prevGoldMg, prevAvg, boughtMg, buyPricePerGram } = input;
  const nextMg = prevGoldMg + boughtMg;
  if (nextMg <= 0 || boughtMg <= 0) return Math.max(0, prevAvg);

  const safePrevAvg =
    prevGoldMg > 0 && prevAvg > 0
      ? prevAvg
      : prevGoldMg > 0
        ? buyPricePerGram
        : 0;

  return Math.round(
    (prevGoldMg * safePrevAvg + boughtMg * buyPricePerGram) / nextMg
  );
}

export function unrealizedPnl(input: {
  goldMg: number;
  marketPricePerGram: number;
  avgBuyPricePerGram: number;
  transactions?: TradeLike[];
}) {
  const goldMg = Math.max(0, input.goldMg);
  const market = Math.max(0, input.marketPricePerGram);
  let avg = Math.max(0, input.avgBuyPricePerGram);

  if (goldMg > 0 && avg <= 0 && input.transactions) {
    avg = averageBuyPriceFromTrades(input.transactions, market);
  }

  const grams = goldMg / 1000;
  const marketValue = Math.floor(grams * market);
  const costBasis = Math.floor(grams * avg);
  const pnl = marketValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  return {
    goldMg,
    grams,
    avgBuyPrice: avg,
    marketPrice: market,
    marketValue,
    costBasis,
    pnl,
    pnlPct,
  };
}
