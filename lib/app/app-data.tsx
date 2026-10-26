"use client";

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

export type TxType = "خرید" | "فروش" | "واریز" | "برداشت" | "تحویل" | "کارمزد" | "هدیه" | "پاداش" | "رزرو";
export type TxStatus =
  | "تکمیل‌شده"
  | "در انتظار تسویه"
  | "در حال پردازش"
  | "ناموفق"
  | "لغو شده";

export type AppTransaction = {
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

export type PriceAlert = {
  id: string;
  direction: "above" | "below";
  priceRial: number;
  channels: string[];
  status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  autoBuyEnabled?: boolean;
  autoBuyToman?: number;
};

export type AppNotification = {
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

export type WithdrawalReceipt = {
  id: string;
  bank_name: string;
  iban: string;
  amount_irr: string;
  fee_irr: string;
  status: string;
  tracking_code: string;
  created_at: string;
};

type AppDataState = {
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
  /** Verified cards (user_bank_cards) with the IBAN Finnotech returned for each. */
  bankAccounts: { id: string; iban: string | null; bank: string; panMasked: string; verified: boolean; depositDefault?: boolean }[];
  transactions: AppTransaction[];
  alerts: PriceAlert[];
  notifications: AppNotification[];
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
  withdraw: (amountToman: number, cardId: string) => Promise<{ ok: boolean; error?: string; message?: string; request?: WithdrawalReceipt }>;
  refreshFinancial: () => Promise<void>;
  addAlert: (alert: Omit<PriceAlert, "id" | "status">) => Promise<MutationResult>;
  markNotificationRead: (id: string) => Promise<MutationResult>;
  markAllNotificationsRead: () => Promise<MutationResult>;
  createTicket: (category: string, subject: string, message: string) => Promise<MutationResult & { id?: string }>;
  replyTicket: (id: string, text: string) => Promise<MutationResult>;
  refreshUserData: () => Promise<void>;
  /** Last load error for alerts/tickets/notifications, shown instead of an empty list. */
  userDataError: string | null;
  refreshMarketPrice: () => Promise<void>;
};

export type MutationResult = { ok: boolean; error?: string; message?: string };

/** Pre-launch demo data lived in these keys; removed on load. */
const LEGACY_KEYS = ["gram_demo_platform_v2", "gram_demo_platform_v1", "gram_plus_sandbox"];

const fa = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "short", timeStyle: "short" }).format(d);
};

async function call<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; message?: string; error?: string };
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.message || (res.status === 401 ? "نشست شما منقضی شده است. دوباره وارد شوید." : "درخواست انجام نشد. دوباره تلاش کنید.") };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید." };
  }
}

const AppDataContext = createContext<AppDataState | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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
  bankAccounts: [] as { id: string; iban: string | null; bank: string; panMasked: string; verified: boolean; depositDefault?: boolean }[],
  transactions: [] as AppTransaction[],
  alerts: [] as PriceAlert[],
  notifications: [] as AppNotification[],
  tickets: [] as SupportTicket[],
  plusActive: false,
  kycStatus: "UNVERIFIED" as KycStatus,
  referralCode: null as string | null,
  commerceSettings: DEFAULT_COMMERCE_SETTINGS,
};

type Persisted = typeof seed;

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted>(seed);
  const [hydrated, setHydrated] = useState(false);
  const [userDataError, setUserDataError] = useState<string | null>(null);

  const refreshUserData = useCallback(async () => {
    const [alerts, tickets, notes, banks] = await Promise.all([
      call<{ alerts: PriceAlert[] }>("/api/me/alerts"),
      call<{ tickets: SupportTicket[] }>("/api/me/support"),
      call<{ notifications: AppNotification[] }>("/api/me/notifications"),
      call<{ bankAccounts: AppDataState["bankAccounts"] }>("/api/me/bank-accounts"),
    ]);
    setState((s) => ({
      ...s,
      alerts: alerts.ok ? alerts.data.alerts : s.alerts,
      tickets: tickets.ok
        ? tickets.data.tickets.map((t) => ({
            ...t,
            createdAt: fa(t.createdAt),
            messages: t.messages.map((m) => ({ ...m, at: fa(m.at) })),
          }))
        : s.tickets,
      notifications: notes.ok
        ? notes.data.notifications.map((n) => ({ ...n, createdAt: fa(n.createdAt) }))
        : s.notifications,
      bankAccounts: banks.ok ? banks.data.bankAccounts : s.bankAccounts,
    }));
    const failed = [alerts, tickets, notes, banks].find((r) => !r.ok);
    setUserDataError(failed && !failed.ok ? failed.error : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        for (const key of LEGACY_KEYS) localStorage.removeItem(key);
      } catch {
        /* storage unavailable */
      }
      const [settingsRes, planRes] = await Promise.all([
        call<CommerceSettings>("/api/commerce/settings"),
        call<{ planTier: "free" | "plus"; referralCode: string | null; kycStatus: KycStatus }>("/api/commerce/plan"),
        refreshUserData(),
      ]);
      if (cancelled) return;
      setState((s) => ({
        ...s,
        commerceSettings: settingsRes.ok ? settingsRes.data : s.commerceSettings,
        plusActive: planRes.ok ? planRes.data.planTier === "plus" : s.plusActive,
        referralCode: planRes.ok ? planRes.data.referralCode : s.referralCode,
        kycStatus: planRes.ok ? (planRes.data.kycStatus ?? "UNVERIFIED") : s.kycStatus,
      }));
      setHydrated(true);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [refreshUserData]);

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
          type: t.type as AppTransaction["type"],
          status: t.status as AppTransaction["status"],
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

  const withdraw = useCallback(
    async (amountToman: number, cardId: string) => {
      const r = await call<{ message?: string; request?: WithdrawalReceipt }>("/api/withdrawals", {
        method: "POST",
        body: JSON.stringify({ amountToman, cardId }),
      });
      if (!r.ok) return { ok: false, error: r.error };
      await refreshFinancial();
      return { ok: true, message: r.data.message, request: r.data.request };
    },
    [refreshFinancial]
  );
  const value = useMemo<AppDataState>(
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
      addAlert: async (alert) => {
        const r = await call<{ message?: string }>("/api/me/alerts", {
          method: "POST",
          body: JSON.stringify({ ...alert, priceToman: alert.priceRial }),
        });
        if (!r.ok) return { ok: false, error: r.error };
        await refreshUserData();
        return { ok: true, message: r.data.message };
      },
      markNotificationRead: async (id) => {
        setState((s) => ({
          ...s,
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }));
        const r = await call("/api/me/notifications", { method: "POST", body: JSON.stringify({ ids: [id] }) });
        if (!r.ok) await refreshUserData();
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      },
      markAllNotificationsRead: async () => {
        setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
        const r = await call("/api/me/notifications", { method: "POST", body: "{}" });
        if (!r.ok) await refreshUserData();
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      },
      createTicket: async (category, subject, message) => {
        const r = await call<{ id: string; message?: string }>("/api/me/support", {
          method: "POST",
          body: JSON.stringify({ category, subject, message }),
        });
        if (!r.ok) return { ok: false, error: r.error };
        await refreshUserData();
        return { ok: true, id: r.data.id, message: r.data.message };
      },
      replyTicket: async (id, text) => {
        const r = await call<{ message?: string }>(`/api/me/support/${encodeURIComponent(id)}`, {
          method: "POST",
          body: JSON.stringify({ message: text }),
        });
        if (!r.ok) return { ok: false, error: r.error };
        await refreshUserData();
        return { ok: true, message: r.data.message };
      },
      refreshUserData,
      userDataError,
      refreshMarketPrice,
    }),
    [hydrated, state, userDataError, refreshUserData, buyMetal, sellMetal, requestQuote, executeQuote, buyGold, sellGold, getMetalMg, getAvgBuyPrice, getMarketPrice, deposit, withdraw, refreshMarketPrice, refreshFinancial]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

export function mgToGramsLabel(mg: number) {
  return (mg / 1000).toLocaleString("fa-IR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}
