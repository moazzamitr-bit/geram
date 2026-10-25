"use client";

import { stripDemoFixtures } from "@/lib/app/demo-fixtures";
import { tradeFailureMessage } from "@/lib/app/trade-errors";
import type { KycStatus } from "@/lib/auth/auth-context";
import type { UiQuote, UiTx } from "@/lib/core-api";
import {
  DEFAULT_COMMERCE_SETTINGS,
  type CommerceSettings,
} from "@/lib/commerce/types";
import { isLiveDisplayQuote } from "@/lib/market/display-price";
import {
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
  alerts: DemoAlert[];
  notifications: DemoNotification[];
  tickets: SupportTicket[];
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
  /** Server-locked quote the user reviews before confirming (price, fee, expiry). */
  requestQuote: (input: {
    instrument: InstrumentId;
    side: "BUY" | "SELL";
    toman?: number;
    metalMg?: number;
  }) => Promise<{ ok: boolean; error?: string; quote?: UiQuote }>;
  executeQuote: (quoteId: string) => Promise<{
    ok: boolean;
    error?: string;
    txId?: string;
    trackingCode?: string;
    createdAt?: string;
    trade?: UiTx;
    balance?: {
      rialAvailable: number;
      goldMg: number;
      silverMg: number;
      copperMg: number;
    } | null;
  }>;
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
  setPin: (pin: string) => void;
  addBankAccount: (iban: string, bank: string) => void;
  addAlert: (
    alert: Omit<DemoAlert, "id" | "status">
  ) => { ok: boolean; error?: string };
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  createTicket: (category: string, subject: string, message: string) => string;
  replyTicket: (id: string, text: string) => void;
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
  marketPriceRial: 0,
  marketPrices: {
    gold18: 0,
    silver925: 0,
    copper: 0,
  } as Record<InstrumentId, number>,
  marketStatus: "paused" as "open" | "closed" | "paused",
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
  bankAccounts: [] as { id: string; iban: string; bank: string; verified: boolean }[],
  transactions: [] as DemoTransaction[],
  goals: [] as DemoGoal[],
  alerts: [] as DemoAlert[],
  notifications: [] as DemoNotification[],
  tickets: [] as SupportTicket[],
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
                notifications: bundle.notifications,
                tickets: bundle.tickets,
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
          const merged = stripDemoFixtures(
            stripFinancial({
              ...seed,
              ...parsed,
              marketPrices: { ...seed.marketPrices },
              marketQuotes: { ...seed.marketQuotes },
              transactions: parsed.transactions ?? [],
              goals: parsed.goals ?? [],
              notifications: parsed.notifications ?? [],
              bankAccounts: parsed.bankAccounts ?? [],
              plusActive: false,
              kycStatus: "UNVERIFIED",
            })
          );
          localStorage.removeItem("gram_plus_sandbox");
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
          sourceKey?: string;
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
        let accepted = 0;
        for (const q of quotes) {
          const id = parseInstrumentId(q.instrument);
          if (!isLiveDisplayQuote({ priceToman: q.priceToman, sourceKey: q.sourceKey })) {
            continue;
          }
          // Gold sanity: reject absurdly low quotes
          if (id === "gold18" && (q.priceToman ?? 0) < 100_000) continue;
          accepted += 1;
          marketPrices[id] = q.priceToman!;
          marketQuotes[id] = {
            highToman: q.highToman ?? null,
            lowToman: q.lowToman ?? null,
            changePercent: q.changePercent ?? null,
            source: q.source ?? "بازار آزاد",
            updatedAt: q.updatedAt ?? new Date().toISOString(),
            stale: Boolean(q.stale),
          };
        }
        if (accepted === 0) return s;
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
      const balRes = await fetch("/api/me/balances", {
        cache: "no-store",
        credentials: "include",
      });
      if (balRes.ok) {
        const data = (await balRes.json()) as {
          ok?: boolean;
          source?: string;
          ui?: {
            goldMg: number;
            silverMg: number;
            copperMg: number;
            rialAvailable: number;
            rialPending: number;
          };
          avgBuyTomanPerGram?: { gold18: number; silver925: number; copper: number };
        };
        if (data.ok && data.source === "ledger" && data.ui) {
          const ui = data.ui;
          setState((s) => ({
            ...s,
            goldMg: ui.goldMg,
            silverMg: ui.silverMg,
            copperMg: ui.copperMg,
            rialAvailable: ui.rialAvailable,
            rialPending: ui.rialPending,
            avgBuyPriceRial: data.avgBuyTomanPerGram?.gold18 ?? 0,
            avgBuyPriceSilverRial: data.avgBuyTomanPerGram?.silver925 ?? 0,
            avgBuyPriceCopperRial: data.avgBuyTomanPerGram?.copper ?? 0,
          }));
        }
      }
    } catch {
      /* A failed ledger read must not fall back to the wallets table. */
    }

    try {
      const { coreApi } = await import("@/lib/core-api");
      const txRes = await coreApi.transactions();
      setState((s) => ({
        ...s,
        transactions: txRes.ui.map((t) => ({
          ...t,
          type: t.type as DemoTransaction["type"],
          status: t.status as DemoTransaction["status"],
          instrument: parseInstrumentId(t.instrument),
        })),
      }));
    } catch {
      /* Activity history is separate from the balance projection. */
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

  const requestQuote = useCallback(
    async (input: {
      instrument: InstrumentId;
      side: "BUY" | "SELL";
      toman?: number;
      metalMg?: number;
    }) => {
      try {
        const { coreApi } = await import("@/lib/core-api");
        const res = await coreApi.issueQuote(
          input.side === "BUY"
            ? {
                instrument: input.instrument,
                side: "BUY",
                inputMode: "RIAL_AMOUNT",
                requestedToman: input.toman ?? 0,
              }
            : {
                instrument: input.instrument,
                side: "SELL",
                inputMode: "METAL_WEIGHT",
                requestedGrams: (input.metalMg ?? 0) / 1000,
              }
        );
        return { ok: true, quote: res.quote.ui };
      } catch (err) {
        return {
          ok: false,
          error: tradeFailureMessage(
            err instanceof Error ? err.message : undefined,
            "دریافت قیمت ممکن نشد."
          ),
        };
      }
    },
    []
  );

  const executeQuote = useCallback(
    async (quoteId: string) => {
      try {
        const { coreApi } = await import("@/lib/core-api");
        const idem =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : uid("idem");
        const traded = await coreApi.executeTrade(quoteId, idem);
        let balance: {
          rialAvailable: number;
          goldMg: number;
          silverMg: number;
          copperMg: number;
        } | null = null;
        try {
          const balRes = await fetch("/api/me/balances", {
            cache: "no-store",
            credentials: "include",
          });
          if (balRes.ok) {
            const data = (await balRes.json()) as {
              ok?: boolean;
              source?: string;
              ui?: {
                rialAvailable: number;
                goldMg: number;
                silverMg: number;
                copperMg: number;
              };
            };
            if (data.ok && data.source === "ledger" && data.ui) balance = data.ui;
          }
        } catch {
          balance = null;
        }
        if (!balance) {
          try {
            const wallet = await coreApi.wallet();
            balance = wallet.wallet.ui;
          } catch {
            balance = null;
          }
        }
        await refreshFinancial();
        return {
          ok: true,
          txId: traded.trade.id,
          trackingCode: traded.trade.trackingCode,
          createdAt: traded.trade.createdAt,
          trade: traded.trade.ui,
          balance,
        };
      } catch (err) {
        return {
          ok: false,
          error: tradeFailureMessage(
            err instanceof Error ? err.message : undefined,
            "ثبت معامله ممکن نشد."
          ),
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

  const deposit = useCallback(async () => {
    return {
      ok: false as const,
      error: "واریز شخصی در این نسخه خاموش است.",
    };
  }, []);

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
      requestQuote,
      executeQuote,
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
      setPin: (pin) => setState((s) => ({ ...s, pin })),
      addBankAccount: (iban, bank) => {
        const next = { id: newId(), iban, bank, verified: false };
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
                  messages: [...t.messages, { from: "user", text, at: nowFa() }],
                }
              : t
          ),
        }));
        if (liveDb) {
          void import("@/lib/db/platform-sync").then(({ persistTicketReply }) =>
            persistTicketReply(id, text, "user")
          );
        }
      },
      refreshMarketPrice,
    }),
    [hydrated, state, liveDb, buyMetal, sellMetal, requestQuote, executeQuote, buyGold, sellGold, getMetalMg, getAvgBuyPrice, getMarketPrice, deposit, withdraw, refreshMarketPrice, refreshFinancial]
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
