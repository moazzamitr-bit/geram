/** A quote safe to show as a live market print. Seed and empty prices are not. */
export function isLiveDisplayQuote(quote: {
  priceToman?: number | null;
  sourceKey?: string | null;
}): boolean {
  if (!quote.priceToman || quote.priceToman < 1) return false;
  if (quote.sourceKey === "seed" || quote.sourceKey === "unavailable") return false;
  return true;
}
