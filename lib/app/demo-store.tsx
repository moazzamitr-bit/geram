"use client";

import {
  averageBuyPriceFromTrades,
  nextAverageBuyPrice,
} from "@/lib/app/pnl";
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
  rialAvailable: number;
  rialPending: number;
  avgBuyPriceRial: number;
  marketPriceRial: number;
  marketStatus: "open" | "closed" | "paused";
  marketSource: string;
  marketUpdatedAt: string | null;
  marketStale: boolean;
  marketHighToman: number | null;
  marketLowToman: number | null;
  marketChangePercent: number | null;
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
  buyGold: (rial: number) => { ok: boolean; error?: string; txId?: string };
  sellGold: (
    goldMg: number,
    destination: "wallet" | "bank"
  ) => { ok: boolean; error?: string; txId?: string };
  deposit: (rial: number) => void;
  withdraw: (rial: number, bankId: string) => { ok: boolean; error?: string };
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
  addAlert: (alert: Omit<DemoAlert, "id" | "status">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  createTicket: (category: string, subject: string, message: string) => string;
  replyTicket: (id: string, text: string) => void;
  addScheduledPurchase: (amountRial: number, cadence: string) => void;
  refreshMarketPrice: () => Promise<void>;
};

const STORAGE_KEY = "gram_demo_platform_v1";

const DemoContext = createContext<DemoState | null>(null);

function nowFa() {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

function tracking() {
  return `GRM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const initialTransactions: DemoTransaction[] = [
  {
    id: "tx-buy-1",
    trackingCode: "GRM-A1B2C3",
    type: "خرید",
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
];

const seed = {
  goldMg: 3241,
  rialAvailable: 12_500_000,
  rialPending: 0,
  avgBuyPriceRial: 6_850_000,
  marketPriceRial: 7_012_000,
  marketStatus: "open" as const,
  marketSource: "در حال دریافت...",
  marketUpdatedAt: null as string | null,
  marketStale: true,
  marketHighToman: null as number | null,
  marketLowToman: null as number | null,
  marketChangePercent: null as number | null,
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
};

type Persisted = typeof seed;

const LIVE_MARKET_KEYS = [
  "marketPriceRial",
  "marketSource",
  "marketUpdatedAt",
  "marketStale",
  "marketHighToman",
  "marketLowToman",
  "marketChangePercent",
] as const;

function stripLiveMarket(state: Persisted): Persisted {
  const next = { ...state };
  for (const key of LIVE_MARKET_KEYS) {
    // keep seed defaults for these; live values come from API
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
            const reconciledAvg =
              bundle.avgBuyPriceRial > 0
                ? bundle.avgBuyPriceRial
                : averageBuyPriceFromTrades(
                    bundle.transactions,
                    // until market quote loads, keep 0; effect below can refine
                    0
                  );
            setLiveDb(true);
            setState((s) =>
              stripLiveMarket({
                ...s,
                goldMg: bundle.goldMg,
                rialAvailable: bundle.rialAvailable,
                rialPending: bundle.rialPending,
                avgBuyPriceRial: reconciledAvg,
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
            setHydrated(true);
            return;
          }
        }
      } catch {
        /* fall back to local sandbox */
      }

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<Persisted>;
          const merged = stripLiveMarket({ ...seed, ...parsed });
          if (merged.goldMg > 0 && merged.avgBuyPriceRial <= 0) {
            merged.avgBuyPriceRial = averageBuyPriceFromTrades(
              merged.transactions,
              merged.marketPriceRial
            );
          }
          setState(merged);
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setHydrated(true);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || liveDb) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripLiveMarket(state)));
  }, [state, hydrated, liveDb]);

  useEffect(() => {
    if (!hydrated || !liveDb) return;
    void (async () => {
      try {
        const { persistWallet } = await import("@/lib/db/platform-sync");
        await persistWallet({
          goldMg: state.goldMg,
          rialAvailable: state.rialAvailable,
          rialPending: state.rialPending,
          avgBuyPriceRial: state.avgBuyPriceRial,
        });
      } catch {
        /* ignore sync errors */
      }
    })();
  }, [
    hydrated,
    liveDb,
    state.goldMg,
    state.rialAvailable,
    state.rialPending,
    state.avgBuyPriceRial,
  ]);

  // If holdings exist but average cost is missing, rebuild from buys (or market).
  useEffect(() => {
    if (!hydrated) return;
    if (state.goldMg <= 0 || state.avgBuyPriceRial > 0) return;
    const fallback =
      state.marketPriceRial > 0
        ? state.marketPriceRial
        : averageBuyPriceFromTrades(state.transactions, 0);
    const next = averageBuyPriceFromTrades(state.transactions, fallback);
    if (next > 0) {
      setState((s) =>
        s.avgBuyPriceRial > 0 ? s : { ...s, avgBuyPriceRial: next }
      );
    }
  }, [
    hydrated,
    state.goldMg,
    state.avgBuyPriceRial,
    state.marketPriceRial,
    state.transactions,
  ]);

  const refreshMarketPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/market/price", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        priceToman?: number;
        source?: string;
        updatedAt?: string;
        stale?: boolean;
        highToman?: number | null;
        lowToman?: number | null;
        changePercent?: number | null;
      };
      if (!data.priceToman || data.priceToman < 100_000) return;
      setState((s) => ({
        ...s,
        marketPriceRial: data.priceToman!,
        marketSource: data.source ?? "TGJU",
        marketUpdatedAt: data.updatedAt ?? new Date().toISOString(),
        marketStale: Boolean(data.stale),
        marketHighToman: data.highToman ?? null,
        marketLowToman: data.lowToman ?? null,
        marketChangePercent: data.changePercent ?? null,
        marketStatus: "open",
      }));
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

  const buyGold = useCallback(
    (rial: number) => {
      if (state.marketStatus !== "open") {
        return { ok: false, error: "بازار در حال حاضر باز نیست." };
      }
      if (rial < 500_000) return { ok: false, error: "حداقل مبلغ خرید ۵۰۰٬۰۰۰ تومان است." };
      if (rial > state.rialAvailable) {
        return { ok: false, error: "موجودی کیف پول کافی نیست." };
      }
      const fee = 50_000;
      const net = rial - fee;
      if (net <= 0) return { ok: false, error: "مبلغ پس از کارمزد معتبر نیست." };
      const goldMg = Math.floor((net / state.marketPriceRial) * 1000);
      const txId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : uid("tx");
      const tx: DemoTransaction = {
        id: txId,
        trackingCode: tracking(),
        type: "خرید",
        goldMg,
        amountRial: rial,
        feeRial: fee,
        pricePerGram: state.marketPriceRial,
        status: "تکمیل‌شده",
        createdAt: nowFa(),
        paymentRef: `WALLET-${Date.now()}`,
        timeline: [
          { label: "سفارش ایجاد شد", done: true, at: "اکنون" },
          { label: "تأیید معامله", done: true, at: "اکنون" },
          { label: "پرداخت از کیف پول", done: true, at: "اکنون" },
          { label: "تخصیص طلا", done: true, at: "اکنون" },
          { label: "ثبت نهایی", done: true, at: "اکنون" },
          { label: "صدور رسید", done: true, at: "اکنون" },
        ],
      };
      const nextAvg = nextAverageBuyPrice({
        prevGoldMg: state.goldMg,
        prevAvg: state.avgBuyPriceRial,
        boughtMg: goldMg,
        buyPricePerGram: state.marketPriceRial,
      });
      setState((s) => ({
        ...s,
        rialAvailable: s.rialAvailable - rial,
        goldMg: s.goldMg + goldMg,
        avgBuyPriceRial: nextAvg,
        transactions: [tx, ...s.transactions],
        notifications: [
          {
            id: uid("n"),
            type: "TRADE",
            title: "خرید طلا انجام شد",
            message: `${(goldMg / 1000).toFixed(3)} گرم به دارایی شما اضافه شد.`,
            createdAt: nowFa(),
            read: false,
            href: `/app/transactions/${txId}`,
          },
          ...s.notifications,
        ],
      }));
      if (liveDb) {
        void import("@/lib/db/platform-sync").then(({ persistTransaction }) =>
          persistTransaction(tx)
        );
      }
      return { ok: true, txId };
    },
    [state, liveDb]
  );

  const sellGold = useCallback(
    (goldMg: number, destination: "wallet" | "bank") => {
      if (state.marketStatus !== "open") {
        return { ok: false, error: "بازار در حال حاضر باز نیست." };
      }
      if (goldMg <= 0 || goldMg > state.goldMg) {
        return { ok: false, error: "مقدار طلای قابل فروش کافی نیست." };
      }
      const gross = Math.floor((goldMg / 1000) * state.marketPriceRial);
      const fee = Math.max(30_000, Math.floor(gross * 0.005));
      const net = gross - fee;
      const txId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : uid("tx");
      const pending = destination === "bank";
      const tx: DemoTransaction = {
        id: txId,
        trackingCode: tracking(),
        type: "فروش",
        goldMg,
        amountRial: net,
        feeRial: fee,
        pricePerGram: state.marketPriceRial,
        status: pending ? "در انتظار تسویه" : "تکمیل‌شده",
        createdAt: nowFa(),
        timeline: [
          { label: "سفارش ایجاد شد", done: true, at: "اکنون" },
          { label: "رزرو طلا", done: true, at: "اکنون" },
          {
            label: destination === "wallet" ? "واریز به کیف پول" : "تسویه بانکی",
            done: !pending,
            at: pending ? undefined : "اکنون",
          },
          { label: "تکمیل", done: !pending },
        ],
        note: destination === "bank" ? "تسویه به حساب بانکی انتخاب‌شده" : "واریز به کیف پول گرم",
      };
      setState((s) => ({
        ...s,
        goldMg: s.goldMg - goldMg,
        rialAvailable: pending ? s.rialAvailable : s.rialAvailable + net,
        rialPending: pending ? s.rialPending + net : s.rialPending,
        transactions: [tx, ...s.transactions],
        notifications: [
          {
            id: uid("n"),
            type: "TRADE",
            title: pending ? "فروش ثبت شد — در انتظار تسویه" : "فروش تکمیل شد",
            message: `مبلغ خالص ${net.toLocaleString("fa-IR")} تومان`,
            createdAt: nowFa(),
            read: false,
            href: `/app/transactions/${txId}`,
          },
          ...s.notifications,
        ],
      }));
      if (liveDb) {
        void import("@/lib/db/platform-sync").then(({ persistTransaction }) =>
          persistTransaction(tx)
        );
      }
      return { ok: true, txId };
    },
    [state, liveDb]
  );

  const deposit = useCallback((rial: number) => {
    setState((s) => ({
      ...s,
      rialAvailable: s.rialAvailable + rial,
      transactions: [
        {
          id: uid("tx"),
          trackingCode: tracking(),
          type: "واریز",
          goldMg: 0,
          amountRial: rial,
          feeRial: 0,
          pricePerGram: s.marketPriceRial,
          status: "تکمیل‌شده",
          createdAt: nowFa(),
          timeline: [
            { label: "درخواست واریز", done: true },
            { label: "تأیید درگاه (سندباکس)", done: true },
            { label: "افزایش موجودی", done: true },
          ],
        },
        ...s.transactions,
      ],
    }));
  }, []);

  const withdraw = useCallback(
    (rial: number, bankId: string) => {
      if (!state.bankAccounts.find((b) => b.id === bankId)?.verified) {
        return { ok: false, error: "حساب بانکی تأییدشده یافت نشد." };
      }
      if (rial > state.rialAvailable) return { ok: false, error: "موجودی کافی نیست." };
      setState((s) => ({
        ...s,
        rialAvailable: s.rialAvailable - rial,
        rialPending: s.rialPending + rial,
        transactions: [
          {
            id: uid("tx"),
            trackingCode: tracking(),
            type: "برداشت",
            goldMg: 0,
            amountRial: rial,
            feeRial: 0,
            pricePerGram: s.marketPriceRial,
            status: "در انتظار تسویه",
            createdAt: nowFa(),
            timeline: [
              { label: "درخواست برداشت", done: true },
              { label: "بررسی امنیتی", done: true },
              { label: "تسویه بانکی", done: false },
            ],
          },
          ...s.transactions,
        ],
      }));
      return { ok: true };
    },
    [state]
  );

  const value = useMemo<DemoState>(
    () => ({
      hydrated,
      ...state,
      buyGold,
      sellGold,
      deposit,
      withdraw,
      addGoal: (goal) => {
        const id = uid("goal");
        setState((s) => ({
          ...s,
          goals: [...s.goals, { ...goal, id, currentRial: 0 }],
        }));
        return id;
      },
      contributeGoal: (goalId, rial) => {
        if (rial > state.rialAvailable) return { ok: false, error: "موجودی کافی نیست." };
        setState((s) => ({
          ...s,
          rialAvailable: s.rialAvailable - rial,
          goals: s.goals.map((g) =>
            g.id === goalId ? { ...g, currentRial: g.currentRial + rial } : g
          ),
        }));
        return { ok: true };
      },
      requestDelivery: ({ productId, productName, weightGrams, method, feeRial }) => {
        const needMg = Math.round(weightGrams * 1000);
        if (needMg > state.goldMg) return { ok: false, error: "طلای قابل تحویل کافی نیست." };
        if (feeRial > state.rialAvailable) return { ok: false, error: "موجودی ریالی برای کارمزد کافی نیست." };
        const id = uid("dlv");
        setState((s) => ({
          ...s,
          goldMg: s.goldMg - needMg,
          rialAvailable: s.rialAvailable - feeRial,
          deliveries: [
            {
              id,
              productId,
              productName,
              weightGrams,
              status: "REQUESTED",
              method,
              createdAt: nowFa(),
              feeRial,
            },
            ...s.deliveries,
          ],
          transactions: [
            {
              id: uid("tx"),
              trackingCode: tracking(),
              type: "تحویل",
              goldMg: needMg,
              amountRial: feeRial,
              feeRial,
              pricePerGram: s.marketPriceRial,
              status: "در حال پردازش",
              createdAt: nowFa(),
              timeline: [
                { label: "ثبت درخواست", done: true },
                { label: "بررسی", done: false },
                { label: "آماده‌سازی", done: false },
                { label: "تحویل", done: false },
              ],
            },
            ...s.transactions,
          ],
        }));
        return { ok: true, id };
      },
      setPin: (pin) => setState((s) => ({ ...s, pin })),
      addBankAccount: (iban, bank) =>
        setState((s) => ({
          ...s,
          bankAccounts: [
            ...s.bankAccounts,
            { id: uid("bank"), iban, bank, verified: true },
          ],
        })),
      addAlert: (alert) =>
        setState((s) => ({
          ...s,
          alerts: [...s.alerts, { ...alert, id: uid("alert"), status: "ACTIVE" }],
        })),
      markNotificationRead: (id) =>
        setState((s) => ({
          ...s,
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllNotificationsRead: () =>
        setState((s) => ({
          ...s,
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),
      createTicket: (category, subject, message) => {
        const id = uid("tkt");
        setState((s) => ({
          ...s,
          tickets: [
            {
              id,
              category,
              subject,
              status: "OPEN",
              createdAt: nowFa(),
              messages: [{ from: "user", text: message, at: nowFa() }],
            },
            ...s.tickets,
          ],
        }));
        return id;
      },
      replyTicket: (id, text) =>
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
                      text: "پیام شما دریافت شد. تیم پشتیبانی به‌زودی پاسخ می‌دهد. (سندباکس)",
                      at: nowFa(),
                    },
                  ],
                }
              : t
          ),
        })),
      addScheduledPurchase: (amountRial, cadence) =>
        setState((s) => ({
          ...s,
          scheduledPurchases: [
            ...s.scheduledPurchases,
            {
              id: uid("sch"),
              amountRial,
              cadence,
              status: "ACTIVE",
              nextRun: "اول ماه آینده",
            },
          ],
        })),
      refreshMarketPrice,
    }),
    [hydrated, state, buyGold, sellGold, deposit, withdraw, refreshMarketPrice]
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
