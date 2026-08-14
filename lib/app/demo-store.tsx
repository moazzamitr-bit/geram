"use client";

import type { KycStatus } from "@/lib/auth/auth-context";
import {
  DEFAULT_COMMERCE_SETTINGS,
  type CommerceSettings,
} from "@/lib/commerce/types";
import {
  INSTRUMENTS,
  type InstrumentId,
  parseInstrumentId,
} from "@/lib/market/instruments";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type TxType = "خرید" | "فروش" | "واریز" | "برداشت" | "تحویل" | "کارمزد";
export type TxStatus =
  | "تکمیل‌شده"
  | "در انتظار تسویه"
  | "در حال پردازش"
  | "ناموفق"
  | "لغو شده";

export type DemoTransaction = {
  id: string;
  trackingCode: string;
  type: TxType;
  instrument: InstrumentId;
  goldMg: number;
  amountRial: number;
  feeRial: number;
  pricePerGram: number;
  status: TxStatus;
  createdAt: string;
  timeline: { label: string; done: boolean; at?: string }[];
  paymentRef?: string;
  note?: string;
};

export type DemoGoal = {
  id: string;
  name: string;
  targetRial: number;
  currentRial: number;
  targetDate: string;
  monthlyRial: number;
};

export type DemoDelivery = {
  id: string;
  productId: string;
  productName: string;
  weightGrams: number;
  status: string;
  method: string;
  createdAt: string;
  feeRial: number;
};

export type DemoAlert = {
  id: string;
  direction: "above" | "below";
  priceRial: number;
  channels: string[];
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  autoBuyEnabled?: boolean;
  autoBuyToman?: number;
};

export type DemoNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

export type SupportTicket = {
  id: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
  messages: { from: "user" | "support"; text: string; at: string }[];
};

type DemoState = {
  hydrated: boolean;
  goldMg: number;
  silverMg: number;
  copperMg: number;
  rialAvailable: number;
  rialPending: number;
  avgBuyPriceRial: number;
  avgBuyPriceSilverRial: number;
  avgBuyPriceCopperRial: number;
  marketPriceRial: number;
  marketPrices: Record<InstrumentId, number>;
  marketStatus: "open" | "closed" | "paused";
  marketSource: string;
  marketUpdatedAt: string | null;
  marketStale: boolean;
  marketHighToman: number | null;
  marketLowToman: number | null;
  marketChangePercent: number | null;
  marketQuotes: Record<
    InstrumentId,
    {
      highToman: number | null;
      lowToman: number | null;
      changePercent: number | null;
      source: string;
      updatedAt: string | null;
      stale: boolean;
    }
  >;
  pin: string | null;
  bankAccounts: { id: string; iban: string; bank: string; verified: boolean }[];
  transactions: DemoTransaction[];
  goals: DemoGoal[];
  deliveries: DemoDelivery[];
  alerts: DemoAlert[];
  notifications: DemoNotification[];
  tickets: SupportTicket[];
  scheduledPurchases: {
    id: string;
    amountRial: number;
    cadence: string;
    status: string;
    nextRun: string;
  }[];
  plusActive: boolean;
  kycStatus: KycStatus;
  referralCode: string | null;
  commerceSettings: CommerceSettings;
  getMetalMg: (instrument: InstrumentId) => number;
  getAvgBuyPrice: (instrument: InstrumentId) => number;
  getMarketPrice: (instrument: InstrumentId) => number;
  buyMetal: (
    instrument: InstrumentId,
    rial: number
  ) => Promise<{ ok: boolean; error?: string; txId?: string }>;
  sellMetal: (
    instrument: InstrumentId,
    metalMg: number,
    destination: "wallet" | "bank"
  ) => Promise<{ ok: boolean; error?: string; txId?: string }>;
  buyGold: (rial: number) => Promise<{ ok: boolean; error?: string; txId?: string }>;
  sellGold: (
    goldMg: number,
    destination: "wallet" | "bank"
  ) => Promise<{ ok: boolean; error?: string; txId?: string }>;
  deposit: (rial: number) => Promise<{ ok: boolean; error?: string }>;
  withdraw: (rial: number, bankId: string) => Promise<{ ok: boolean; error?: string }>;
  refreshFinancial: () => Promise<void>;
  addGoal: (goal: Omit<DemoGoal, "id" | "currentRial">) => string;
  contributeGoal: (goalId: string, rial: number) => { ok: boolean; error?: string };
  requestDelivery: (input: {
    productId: string;
    productName: string;
    weightGrams: number;
    method: string;
    feeRial: number;
  }) => { ok: boolean; error?: string; id?: string };
  setPin: (pin: string) => void;
  addBankAccount: (iban: string, bank: string) => void;
  addAlert: (
    alert: Omit<DemoAlert, "id" | "status">
  ) => { ok: boolean; error?: string };
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  createTicket: (category: string, subject: string, message: string) => string;
  replyTicket: (id: string, text: string) => void;
  addScheduledPurchase: (amountRial: number, cadence: string) => { ok: boolean; error?: string };
  applyReferralCode: (code: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
  activatePlusSandbox: () => Promise<{ ok: boolean; error?: string; message?: string }>;
  refreshMarketPrice: () => Promise<void>;
};

const STORAGE_KEY = "gram_demo_platform_v2";

const DemoContext = createContext<DemoState | null>(null);

function nowFa() {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return uid("id");
}

const initialTransactions: DemoTransaction[] = [
  {
    id: "tx-buy-1",
    trackingCode: "GRM-A1B2C3",
    type: "خرید",
    instrument: "gold18",
    goldMg: 125,
    amountRial: 950_000,
    feeRial: 25_000,
    pricePerGram: 7_000_000,
    status: "تکمیل‌شده",
    createdAt: "۱۴۰۴/۰۵/۱۲، ۱۴:۲۰",
    timeline: [
      { label: "سفارش ایجاد شد", done: true, at: "۱۴:۲۰" },
      { label: "پرداخت", done: true, at: "۱۴:۲۰" },
      { label: "تخصیص طلا", done: true, at: "۱۴:۲۱" },
      { label: "ثبت نهایی", done: true, at: "۱۴:۲۱" },
    ],
    paymentRef: "PAY-9912",
  },
  {
    id: "tx-sell-1",
    trackingCode: "GRM-D4E5F6",
    type: "فروش",
    instrument: "gold18",
    goldMg: 800,
    amountRial: 6_100_000,
    feeRial: 40_000,
    pricePerGram: 7_675_000,
    status: "در انتظار تسویه",
    createdAt: "۱۴۰۴/۰۵/۱۰، ۱۱:۰۵",
    timeline: [
      { label: "سفارش ایجاد شد", done: true, at: "۱۱:۰۵" },
      { label: "رزرو طلا", done: true, at: "۱۱:۰۵" },
      { label: "تسویه", done: false },
      { label: "تکمیل", done: false },
    ],
  },
  {
    id: "tx-buy-2",
    trackingCode: "GRM-G7H8I9",
    type: "خرید",
    instrument: "gold18",
    goldMg: 1200,
    amountRial: 8_200_000,
    feeRial: 50_000,
    pricePerGram: 6_791_000,
    status: "تکمیل‌شده",
    createdAt: "۱۴۰۴/۰۵/۰۲، ۰۹:۴۰",
    timeline: [
      { label: "سفارش ایجاد شد", done: true },
      { label: "پرداخت", done: true },
      { label: "تخصیص طلا", done: true },
      { label: "ثبت نهایی", done: true },
    ],
  },
  {
    id: "tx-buy-silver-1",
    trackingCode: "GRM-AG01",
    type: "خرید",
    instrument: "silver925",
    goldMg: 5000,
    amountRial: 1_950_000,
    feeRial: 20_000,
    pricePerGram: 386_000,
    status: "تکمیل‌شده",
    createdAt: "۱۴۰۴/۰۵/۰۸، ۱۶:۱۰",
    timeline: [
      { label: "سفارش ایجاد شد", done: true },
      { label: "پرداخت", done: true },
      { label: "تخصیص نقره", done: true },
      { label: "ثبت نهایی", done: true },
    ],
  },
  {
    id: "tx-buy-copper-1",
    trackingCode: "GRM-CU01",
    type: "خرید",
    instrument: "copper",
    goldMg: 200_000,
    amountRial: 520_000,
    feeRial: 10_000,
    pricePerGram: 2_550,
    status: "تکمیل‌شده",
    createdAt: "۱۴۰۴/۰۵/۰۹، ۱۲:۴۰",
    timeline: [
      { label: "سفارش ایجاد شد", done: true },
      { label: "پرداخت", done: true },
      { label: "تخصیص مس", done: true },
      { label: "ثبت نهایی", done: true },
    ],
  },
];

const emptyQuoteMeta = {
  highToman: null as number | null,
  lowToman: null as number | null,
  changePercent: null as number | null,
  source: "در حال دریافت...",
  updatedAt: null as string | null,
  stale: true,
};

const seed = {
  goldMg: 0,
  silverMg: 0,
  copperMg: 0,
  rialAvailable: 0,
  rialPending: 0,
  avgBuyPriceRial: 0,
  avgBuyPriceSilverRial: 0,
  avgBuyPriceCopperRial: 0,
  marketPriceRial: INSTRUMENTS.gold18.fallbackPriceToman,
  marketPrices: {
    gold18: INSTRUMENTS.gold18.fallbackPriceToman,
    silver925: INSTRUMENTS.silver925.fallbackPriceToman,
    copper: INSTRUMENTS.copper.fallbackPriceToman,
  } as Record<InstrumentId, number>,
  marketStatus: "open" as const,
  marketSource: "در حال دریافت...",
  marketUpdatedAt: null as string | null,
  marketStale: true,
  marketHighToman: null as number | null,
  marketLowToman: null as number | null,
  marketChangePercent: null as number | null,
  marketQuotes: {
    gold18: { ...emptyQuoteMeta },
    silver925: { ...emptyQuoteMeta },
    copper: { ...emptyQuoteMeta },
  } as Record<
    InstrumentId,
    {
      highToman: number | null;
      lowToman: number | null;
      changePercent: number | null;
      source: string;
      updatedAt: string | null;
      stale: boolean;
    }
  >,
  pin: null as string | null,
  bankAccounts: [
    {
      id: "bank-1",
      iban: "IR120170000000123456789001",
      bank: "بانک ملی",
      verified: true,
    },
  ],
  transactions: initialTransactions,
  goals: [
    {
      id: "goal-car",
      name: "خرید خودرو",
      targetRial: 230_000_000,
      currentRial: 98_000_000,
      targetDate: "آذر ۱۴۰۴",
      monthlyRial: 12_500_000,
    },
  ],
  deliveries: [] as DemoDelivery[],
  alerts: [] as DemoAlert[],
  notifications: [
    {
      id: "n1",
      type: "TRADE",
      title: "خرید با موفقیت انجام شد",
      message: "۰.۱۲۵ گرم طلا به دارایی شما اضافه شد.",
      createdAt: "۱۴۰۴/۰۵/۱۲",
      read: false,
      href: "/app/transactions/tx-buy-1",
    },
    {
      id: "n2",
      type: "SECURITY",
      title: "ورود جدید",
      message: "ورود سندباکس از دستگاه فعلی ثبت شد.",
      createdAt: "امروز",
      read: true,
    },
  ] as DemoNotification[],
  tickets: [] as SupportTicket[],
  scheduledPurchases: [] as DemoState["scheduledPurchases"],
  plusActive: false,
  kycStatus: "UNVERIFIED" as KycStatus,
  referralCode: null as string | null,
  commerceSettings: DEFAULT_COMMERCE_SETTINGS,
};

type Persisted = typeof seed;

const LIVE_MARKET_KEYS = [
  "marketPriceRial",
  "marketPrices",
  "marketSource",
  "marketUpdatedAt",
  "marketStale",
  "marketHighToman",
  "marketLowToman",
  "marketChangePercent",
  "marketQuotes",
] as const;

function stripLiveMarket(state: Persisted): Persisted {
  const next = { ...state };
  for (const key of LIVE_MARKET_KEYS) {
    (next as Record<string, unknown>)[key] = seed[key];
  }
  return next;
}

const FINANCIAL_KEYS = [
  "goldMg",
  "silverMg",
  "copperMg",
  "rialAvailable",
  "rialPending",
  "avgBuyPriceRial",
  "avgBuyPriceSilverRial",
  "avgBuyPriceCopperRial",
] as const;

function stripFinancial(state: Persisted): Persisted {
  const next = stripLiveMarket(state);
  for (const key of FINANCIAL_KEYS) {
    (next as Record<string, unknown>)[key] = seed[key];
  }
  return next;
}

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted>(seed);
  const [hydrated, setHydrated] = useState(false);
  const [liveDb, setLiveDb] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const { hasSupabaseEnv } = await import("@/lib/supabase/client");
        if (hasSupabaseEnv()) {
          const { loadPlatformBundle } = await import("@/lib/db/platform-sync");
          const bundle = await loadPlatformBundle();
          if (bundle && !cancelled) {
            setLiveDb(true);
            setState((s) =>
              stripLiveMarket({
                ...s,
                goldMg: bundle.goldMg,
                silverMg: bundle.silverMg,
                copperMg: bundle.copperMg,
                rialAvailable: bundle.rialAvailable,
                rialPending: bundle.rialPending,
                avgBuyPriceRial: bundle.avgBuyPriceRial,
                avgBuyPriceSilverRial: bundle.avgBuyPriceSilverRial,
                avgBuyPriceCopperRial: bundle.avgBuyPriceCopperRial,
                bankAccounts: bundle.bankAccounts,
                transactions: bundle.transactions,
                goals: bundle.goals,
                deliveries: bundle.deliveries,
                notifications: bundle.notifications,
                tickets: bundle.tickets,
                scheduledPurchases: bundle.scheduledPurchases,
                alerts: bundle.alerts,
                pin: s.pin,
              })
            );
            try {
              const [settingsRes, planRes] = await Promise.all([
                fetch("/api/commerce/settings", { cache: "no-store" }),
                fetch("/api/commerce/plan", { cache: "no-store" }),
              ]);
              if (!cancelled && settingsRes.ok) {
                const settings = (await settingsRes.json()) as CommerceSettings;
                setState((s) => ({ ...s, commerceSettings: settings }));
              }
              if (!cancelled && planRes.ok) {
                const plan = (await planRes.json()) as {
                  planTier: "free" | "plus";
                  referralCode: string | null;
                  kycStatus: KycStatus;
                };
                setState((s) => ({
                  ...s,
                  plusActive: plan.planTier === "plus",
                  referralCode: plan.referralCode,
                  kycStatus: plan.kycStatus ?? "UNVERIFIED",
                }));
              }
            } catch {
              /* defaults */
            }
            setHydrated(true);
            return;
          }
        }
      } catch {
        /* fall back to local sandbox */
      }

      try {
        const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("gram_demo_platform_v1");
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<Persisted>;
          const merged = stripFinancial({
            ...seed,
            ...parsed,
            marketPrices: {
              ...seed.marketPrices,
              ...(parsed.marketPrices ?? {}),
            },
            marketQuotes: {
              ...seed.marketQuotes,
              ...(parsed.marketQuotes ?? {}),
            },
            transactions: seed.transactions,
          });
          const plusRaw = localStorage.getItem("gram_plus_sandbox");
          if (plusRaw === "1") merged.plusActive = true;
          setState(merged);
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        try {
          const [settingsRes, planRes] = await Promise.all([
            fetch("/api/commerce/settings", { cache: "no-store" }),
            fetch("/api/commerce/plan", { cache: "no-store" }),
          ]);
          if (settingsRes.ok) {
            const settings = (await settingsRes.json()) as CommerceSettings;
            setState((s) => ({ ...s, commerceSettings: settings }));
          }
          if (planRes.ok) {
            const plan = (await planRes.json()) as {
              planTier: "free" | "plus";
              referralCode: string | null;
              kycStatus: KycStatus;
            };
            setState((s) => ({
              ...s,
              plusActive: plan.planTier === "plus",
              referralCode: plan.referralCode,
              kycStatus: plan.kycStatus ?? s.kycStatus,
            }));
          }
        } catch {
          /* ignore */
        }
        setHydrated(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || liveDb) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripFinancial(state)));
  }, [state, hydrated, liveDb]);

  useEffect(() => {
    if (!hydrated || !liveDb) return;
    // Wallet balances are ledger projections. Never write wallets from the client.
  }, [hydrated, liveDb]);

  const refreshMarketPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/market/price?all=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        quotes?: Array<{
          instrument?: string;
          priceToman?: number;
          source?: string;
          updatedAt?: string;
          stale?: boolean;
          highToman?: number | null;
          lowToman?: number | null;
          changePercent?: number | null;
        }>;
      };
      const quotes = data.quotes ?? [];
      if (!quotes.length) return;

      setState((s) => {
        const marketPrices = { ...s.marketPrices };
        const marketQuotes = { ...s.marketQuotes };
        for (const q of quotes) {
          const id = parseInstrumentId(q.instrument);
          if (!q.priceToman || q.priceToman < 1) continue;
          // Gold sanity: reject absurdly low quotes
          if (id === "gold18" && q.priceToman < 100_000) continue;
          marketPrices[id] = q.priceToman;
          marketQuotes[id] = {
            highToman: q.highToman ?? null,
            lowToman: q.lowToman ?? null,
            changePercent: q.changePercent ?? null,
            source: q.source ?? "بازار آزاد",
            updatedAt: q.updatedAt ?? new Date().toISOString(),
            stale: Boolean(q.stale),
          };
        }
        const gold = marketQuotes.gold18;
        return {
          ...s,
          marketPrices,
          marketQuotes,
          marketPriceRial: marketPrices.gold18,
          marketSource: gold.source,
          marketUpdatedAt: gold.updatedAt,
          marketStale: gold.stale,
          marketHighToman: gold.highToman,
          marketLowToman: gold.lowToman,
          marketChangePercent: gold.changePercent,
          marketStatus: "open",
        };
      });
    } catch {
      /* keep last known price */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refreshMarketPrice();
    const id = window.setInterval(() => {
      void refreshMarketPrice();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [hydrated, refreshMarketPrice]);

  const getMetalMg = useCallback(
    (instrument: InstrumentId) => {
      if (instrument === "silver925") return state.silverMg;
      if (instrument === "copper") return state.copperMg;
      return state.goldMg;
    },
    [state.goldMg, state.silverMg, state.copperMg]
  );

  const getAvgBuyPrice = useCallback(
    (instrument: InstrumentId) => {
      if (instrument === "silver925") return state.avgBuyPriceSilverRial;
      if (instrument === "copper") return state.avgBuyPriceCopperRial;
      return state.avgBuyPriceRial;
    },
    [state.avgBuyPriceRial, state.avgBuyPriceSilverRial, state.avgBuyPriceCopperRial]
  );

  const getMarketPrice = useCallback(
    (instrument: InstrumentId) => state.marketPrices[instrument] ?? 0,
    [state.marketPrices]
  );

  const refreshFinancial = useCallback(async () => {
    try {
      const readyRes = await fetch("/api/core/readiness", { cache: "no-store" });
      if (!readyRes.ok) return;
      const ready = (await readyRes.json()) as { databaseBacked?: boolean };
      // Until the operational ledger is Postgres-backed and opening balances
      // are migrated, keep the existing `wallets` table as the display source.
      if (!ready.databaseBacked) return;

      const { coreApi } = await import("@/lib/core-api");
      const [walletRes, txRes] = await Promise.all([
        coreApi.wallet(),
        coreApi.transactions().catch(() => ({ ok: true as const, ui: [] })),
      ]);
      const ui = walletRes.wallet.ui;
      setState((s) => ({
        ...s,
        goldMg: ui.goldMg,
        silverMg: ui.silverMg,
        copperMg: ui.copperMg,
        rialAvailable: ui.rialAvailable,
        rialPending: ui.rialPending,
        avgBuyPriceRial: walletRes.avgBuyTomanPerGram.gold18,
        avgBuyPriceSilverRial: walletRes.avgBuyTomanPerGram.silver925,
        avgBuyPriceCopperRial: walletRes.avgBuyTomanPerGram.copper,
        transactions:
          txRes.ui.length > 0
            ? txRes.ui.map((t) => ({
                ...t,
                type: t.type as DemoTransaction["type"],
                status: t.status as DemoTransaction["status"],
                instrument: parseInstrumentId(t.instrument),
              }))
            : s.transactions.filter((t) => t.type !== "خرید" && t.type !== "فروش" && t.type !== "واریز"),
      }));
    } catch {
      /* keep last known ledger projection */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refreshFinancial();
  }, [hydrated, refreshFinancial]);

  const buyMetal = useCallback(
    async (instrument: InstrumentId, rial: number) => {
      try {
        const { coreApi } = await import("@/lib/core-api");
        const quoted = await coreApi.issueQuote({
          instrument,
          side: "BUY",
          inputMode: "RIAL_AMOUNT",
          requestedToman: rial,
        });
        const idem =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : uid("idem");
        const traded = await coreApi.executeTrade(quoted.quote.id, idem);
        await refreshFinancial();
        return { ok: true, txId: traded.trade.id };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "خطا در خرید",
        };
      }
    },
    [refreshFinancial]
  );

  const sellMetal = useCallback(
    async (
      instrument: InstrumentId,
      metalMg: number,
      destination: "wallet" | "bank"
    ) => {
      if (destination === "bank") {
        return {
          ok: false,
          error: "تسویه بانکی در این نسخه فعال نیست. فروش به کیف پول گرم استفاده کنید.",
        };
      }
      try {
        const { coreApi } = await import("@/lib/core-api");
        const quoted = await coreApi.issueQuote({
          instrument,
          side: "SELL",
          inputMode: "METAL_WEIGHT",
          requestedGrams: metalMg / 1000,
        });
        const idem =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : uid("idem");
        const traded = await coreApi.executeTrade(quoted.quote.id, idem);
        await refreshFinancial();
        return { ok: true, txId: traded.trade.id };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "خطا در فروش",
        };
      }
    },
    [refreshFinancial]
  );

  const buyGold = useCallback(
    (rial: number) => buyMetal("gold18", rial),
    [buyMetal]
  );

  const sellGold = useCallback(
    (goldMg: number, destination: "wallet" | "bank") =>
      sellMetal("gold18", goldMg, destination),
    [sellMetal]
  );

  const deposit = useCallback(
    async (rial: number) => {
      try {
        const { coreApi } = await import("@/lib/core-api");
        const idem =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : uid("idem");
        await coreApi.sandboxDeposit(rial, idem);
        await refreshFinancial();
        return { ok: true as const };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : "واریز سندباکس ممکن نیست",
        };
      }
    },
    [refreshFinancial]
  );

  const withdraw = useCallback(async () => {
    return {
      ok: false,
      error: "برداشت بانکی در این نسخه فعال نیست.",
    };
  }, []);
  const value = useMemo<DemoState>(
    () => ({
      hydrated,
      ...state,
      buyMetal,
      sellMetal,
      buyGold,
      sellGold,
      getMetalMg,
      getAvgBuyPrice,
      getMarketPrice,
      deposit,
      withdraw,
      refreshFinancial,
      addGoal: (goal) => {
        const id = newId();
        const next = { ...goal, id, currentRial: 0 };
        setState((s) => ({
          ...s,
          goals: [...s.goals, next],
        }));
        if (liveDb) {
          void import("@/lib/db/platform-sync").then(({ persistGoal }) =>
            persistGoal(next)
          );
        }
        return id;
      },
      contributeGoal: () => {
        return {
          ok: false,
          error: "واریز به هدف فعلاً به دفترکل متصل نیست.",
        };
      },
      requestDelivery: () => {
        return {
          ok: false,
          error: "تحویل فیزیکی در این نسخه فعال نیست.",
        };
      },
      setPin: (pin) => setState((s) => ({ ...s, pin })),
      addBankAccount: (iban, bank) => {
        const next = { id: newId(), iban, bank, verified: true };
        setState((s) => ({
          ...s,
          bankAccounts: [...s.bankAccounts, next],
        }));
        if (liveDb) {
          void import("@/lib/db/platform-sync").then(({ persistBankAccount }) =>
            persistBankAccount(next)
          );
        }
      },
      addAlert: (alert) => {
        if (
          alert.channels.includes("sms") &&
          state.commerceSettings.plus.smsAlertsPlusOnly &&
          !state.plusActive
        ) {
          return { ok: false, error: "اعلان SMS فقط برای اعضای گرم پلاس است." };
        }
        const next = {
          ...alert,
          id: newId(),
          status: "ACTIVE" as const,
        };
        setState((s) => ({
          ...s,
          alerts: [...s.alerts, next],
        }));
        if (liveDb) {
          void import("@/lib/db/platform-sync").then(({ persistAlert }) =>
            persistAlert(next)
          );
        }
        return { ok: true };
      },
      markNotificationRead: (id) => {
        setState((s) => ({
          ...s,
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
        if (liveDb) {
          void import("@/lib/db/platform-sync").then(({ markNotificationsRead }) =>
            markNotificationsRead([id])
          );
        }
      },
      markAllNotificationsRead: () => {
        setState((s) => ({
          ...s,
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        }));
        if (liveDb) {
          void import("@/lib/db/platform-sync").then(({ markNotificationsRead }) =>
            markNotificationsRead()
          );
        }
      },
      createTicket: (category, subject, message) => {
        const id = newId();
        const ticket: SupportTicket = {
          id,
          category,
          subject,
          status: "OPEN",
          createdAt: nowFa(),
          messages: [{ from: "user", text: message, at: nowFa() }],
        };
        setState((s) => ({
          ...s,
          tickets: [ticket, ...s.tickets],
        }));
        if (liveDb) {
          void import("@/lib/db/platform-sync").then(({ persistTicket }) =>
            persistTicket(ticket, message)
          );
        }
        return id;
      },
      replyTicket: (id, text) => {
        setState((s) => ({
          ...s,
          tickets: s.tickets.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: "WAITING_USER",
                  messages: [
                    ...t.messages,
                    { from: "user", text, at: nowFa() },
                    {
                      from: "support",
                      text: "پیام شما دریافت شد. تیم پشتیبانی به‌زودی پاسخ می‌دهد.",
                      at: nowFa(),
                    },
                  ],
                }
              : t
          ),
        }));
        if (liveDb) {
          void import("@/lib/db/platform-sync").then(({ persistTicketReply }) => {
            void persistTicketReply(id, text, "user");
            void persistTicketReply(
              id,
              "پیام شما دریافت شد. تیم پشتیبانی به‌زودی پاسخ می‌دهد.",
              "support"
            );
          });
        }
      },
      addScheduledPurchase: (amountRial, cadence) => {
        const max = state.plusActive
          ? state.commerceSettings.plus.maxDcaPlus
          : state.commerceSettings.plus.maxDcaFree;
        const active = state.scheduledPurchases.filter(
          (s) => s.status === "ACTIVE"
        ).length;
        if (active >= max) {
          return {
            ok: false,
            error: state.plusActive
              ? `حداکثر ${max} برنامه خرید دوره‌ای فعال دارید.`
              : `در پلن رایگان فقط ${max} برنامه مجاز است. گرم پلاس را فعال کنید.`,
          };
        }
        const nextRun = new Date();
        nextRun.setDate(nextRun.getDate() + 1);
        const next = {
          id: newId(),
          amountRial,
          cadence,
          status: "ACTIVE",
          nextRun: nextRun.toLocaleDateString("fa-IR"),
        };
        setState((s) => ({
          ...s,
          scheduledPurchases: [...s.scheduledPurchases, next],
        }));
        if (liveDb) {
          void import("@/lib/db/platform-sync").then(
            ({ persistScheduledPurchase }) => persistScheduledPurchase(next)
          );
        }
        return { ok: true };
      },
      applyReferralCode: async (code) => {
        try {
          const res = await fetch("/api/referral/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const data = (await res.json()) as {
            ok: boolean;
            error?: string;
            message?: string;
          };
          if (!data.ok) return { ok: false, error: data.error ?? "خطا" };
          return { ok: true, message: data.message };
        } catch {
          return { ok: false, error: "خطا در ثبت کد دعوت" };
        }
      },
      activatePlusSandbox: async () => {
        try {
          const res = await fetch("/api/commerce/plus/activate-sandbox", {
            method: "POST",
          });
          const data = (await res.json()) as {
            ok: boolean;
            error?: string;
            message?: string;
          };
          if (!data.ok) {
            if (!liveDb) {
              localStorage.setItem("gram_plus_sandbox", "1");
              setState((s) => ({ ...s, plusActive: true }));
              return { ok: true, message: "گرم پلاس (محلی) فعال شد." };
            }
            return { ok: false, error: data.error ?? "خطا" };
          }
          setState((s) => ({ ...s, plusActive: true }));
          return { ok: true, message: data.message };
        } catch {
          localStorage.setItem("gram_plus_sandbox", "1");
          setState((s) => ({ ...s, plusActive: true }));
          return { ok: true, message: "گرم پلاس (محلی) فعال شد." };
        }
      },
      refreshMarketPrice,
    }),
    [hydrated, state, liveDb, buyMetal, sellMetal, buyGold, sellGold, getMetalMg, getAvgBuyPrice, getMarketPrice, deposit, withdraw, refreshMarketPrice, refreshFinancial]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoStore() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoStore must be used within DemoStoreProvider");
  return ctx;
}

export function mgToGramsLabel(mg: number) {
  return (mg / 1000).toLocaleString("fa-IR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}
