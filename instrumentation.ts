/**
 * Server boot hook: keeps market caches warm so user-facing price and history
 * calls are served from memory (<1s) instead of waiting on TGJU (6–20s).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.GERAM_MARKET_WARMER === "off") return;
  const { refreshLivePrices } = await import("@/lib/market/price-provider");
  const { refreshAllHistory } = await import("@/lib/market/history-provider");
  let historyBusy = false;
  const warmHistory = async () => {
    if (historyBusy) return;
    historyBusy = true;
    try {
      await refreshAllHistory();
    } finally {
      historyBusy = false;
    }
  };
  void refreshLivePrices();
  void warmHistory();
  setInterval(() => void refreshLivePrices(), 20_000).unref?.();
  setInterval(() => void warmHistory(), 4 * 60_000).unref?.();
}
