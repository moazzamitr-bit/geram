export const demoPortfolio = {
  goldGramsDisplay: "۳.۲۴۱",
  goldMicrograms: 3_241_000, // placeholder integer unit until Phase 2
  valueRial: 24_630_000,
  periodChangePercent: 3.4,
  avgBuyPriceRial: 6_850_000,
  sellableGramsDisplay: "۳.۲۴۱",
  pendingAllocationGramsDisplay: "۰",
  rialAvailable: 12_500_000,
  rialPending: 0,
  isSimulation: true,
} as const;

export const demoMarket = {
  title: "طلای ۱۸ عیار",
  priceRial: 7_012_000,
  changePercent: 1.2,
  highRial: 7_090_000,
  lowRial: 6_940_000,
  updatedAt: "۱۷:۴۲:۱۲",
  status: "open" as const,
  statusLabel: "بازار باز است",
  isSimulation: true,
};

export const demoGoal = {
  id: "goal-car",
  name: "خرید خودرو",
  progressPercent: 42,
  currentRial: 98_000_000,
  targetRial: 230_000_000,
  suggestion:
    "برای رسیدن به هدف تا آذر، ماهانه ۱۲.۵ میلیون تومان پس‌انداز کنید.",
  isSimulation: true,
};

export const demoTrust = {
  coveragePercent: 100,
  lastReconciliation: "امروز، ۱۶:۳۰",
  vaultStatus: "عادی",
  isSimulation: true,
};

export const demoTransactions = [
  {
    id: "tx-buy-1",
    type: "خرید",
    amount: "۰.۱۲۵ گرم",
    value: "۹۵۰٬۰۰۰ تومان",
    status: "تکمیل‌شده",
    date: "۱۴۰۴/۰۵/۱۲",
  },
  {
    id: "tx-sell-1",
    type: "فروش",
    amount: "۰.۸ گرم",
    value: "۶٬۱۰۰٬۰۰۰ تومان",
    status: "در انتظار تسویه",
    date: "۱۴۰۴/۰۵/۱۰",
  },
  {
    id: "tx-buy-2",
    type: "خرید",
    amount: "۱.۲ گرم",
    value: "۸٬۲۰۰٬۰۰۰ تومان",
    status: "تکمیل‌شده",
    date: "۱۴۰۴/۰۵/۰۲",
  },
] as const;
