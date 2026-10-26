import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/db/types";
import {
  getExecutionMode,
  getFeatureFlags,
  getKillSwitches,
} from "@/lib/core/mode";
import { irrToSafeTomanNumber, ugToSafeMgNumber } from "@/lib/core/money";
import { PLATFORM_HOLDER } from "@/lib/core/types";
import { COPPER_STALE_AFTER_MS, isTimestampStale, SPOT_STALE_AFTER_MS } from "@/lib/market/freshness";
import { readLedgerAccountRows } from "@/lib/ledger/read";
import { sumCustomerLedger } from "@/lib/ledger/display";
import { listCoreTrades, listOpeningJournals } from "./ledger-activity";
import { UNAVAILABLE } from "./status";
import type { OpsState } from "./status";

export type Metric =
  | { kind: "value"; value: number | string }
  | { kind: "unavailable"; reason?: string };

function val(n: number | string): Metric {
  return { kind: "value", value: n };
}
function na(reason = UNAVAILABLE): Metric {
  return { kind: "unavailable", reason };
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function daysAgo(n: number) {
  const x = new Date();
  x.setDate(x.getDate() - n);
  return x.toISOString();
}

function asBig(value: unknown): bigint {
  const raw = String(value ?? "0").trim().split(".")[0]?.replace(/[^\d-]/g, "") ?? "0";
  if (!raw || raw === "-") return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

function safeToman(amount: bigint): number | null {
  try {
    return irrToSafeTomanNumber(amount);
  } catch {
    return null;
  }
}

function safeMg(weight: bigint): number | null {
  try {
    return ugToSafeMgNumber(weight);
  } catch {
    return null;
  }
}

export async function loadDashboardOps() {
  const mode = (() => {
    try {
      return getExecutionMode();
    } catch {
      return null;
    }
  })();
  const flags = mode ? getFeatureFlags(mode) : null;
  const kills = getKillSwitches();
  const ledgerReady = Boolean(
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL
  );

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { connected: false as const, mode, flags, kills, ledgerReady };
  }

  const sb = createServiceClient();
  const today = startOfDay();
  const d7 = daysAgo(7);
  const d30 = daysAgo(30);

  const [
    users,
    kycV,
    kycP,
    kycR,
    newToday,
    new7,
    new30,
    tickets,
    pendingKyc,
    price,
    banks,
    dca,
    alerts,
    expiredQuotes,
    outbox,
    platformAccounts,
    todayTrades,
    todayJournals,
  ] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "VERIFIED"),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "PENDING"),
    sb.from("profiles").select("id", { count: "exact", head: true }).in("kyc_status", ["REJECTED", "NEEDS_UPDATE"]),
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", today),
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d7),
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d30),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["OPEN", "WAITING_USER"]),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "PENDING"),
    sb.from("market_prices").select("price_toman, instrument, observed_at, source").order("observed_at", { ascending: false }).limit(12),
    sb.from("user_bank_cards").select("id, status"),
    sb.from("scheduled_purchases").select("id, status"),
    sb.from("price_alerts").select("id, status"),
    sb.from("core_quotes").select("id", { count: "exact", head: true }).eq("status", "EXPIRED"),
    sb.from("core_outbox").select("id", { count: "exact", head: true }).is("processed_at", null),
    sb
      .from("core_ledger_accounts")
      .select("account_code, asset, balance")
      .eq("holder_id", PLATFORM_HOLDER)
      .in("account_code", ["PLATFORM_AVAILABLE", "PLATFORM_RESERVED", "PLATFORM_CASH_CONTROL"]),
    listCoreTrades({ since: today, limit: 2000 }),
    listOpeningJournals({ since: today, limit: 500 }),
  ]);

  const buys = todayTrades.filter((trade) => trade.type === "خرید");
  const sells = todayTrades.filter((trade) => trade.type === "فروش");
  const failed = todayTrades.filter((trade) => trade.status === "FAILED");
  const volume = (rows: typeof todayTrades, instrument: string) =>
    rows.filter((row) => row.instrument === instrument).reduce((sum, row) => sum + row.gold_mg, 0);

  const ledgerAccounts = await readLedgerAccountRows();
  const books = ledgerAccounts.ok ? sumCustomerLedger(ledgerAccounts.rows) : null;
  const ledgerNa = na(ledgerAccounts.ok ? "جمع دفترکل از حد نمایش خارج است" : ledgerAccounts.error);

  const platformRows = platformAccounts.error ? null : (platformAccounts.data ?? []);
  const platformBalance = (code: string, asset: string) => {
    const row = platformRows?.find((item) => item.account_code === code && item.asset === asset);
    return row ? asBig(row.balance) : 0n;
  };
  const metalLine = (code: string) => {
    if (!platformRows) return null;
    const parts = (["GOLD", "SILVER", "COPPER"] as const).map((asset) => {
      const mg = safeMg(platformBalance(code, asset));
      const label = asset === "GOLD" ? "طلا" : asset === "SILVER" ? "نقره" : "مس";
      return mg == null ? null : `${label} ${(mg / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم`;
    });
    if (parts.some((part) => part == null)) return null;
    return parts.join(" · ");
  };
  const cashToman = platformRows ? safeToman(platformBalance("PLATFORM_CASH_CONTROL", "IRR")) : null;

  let liveStale: number | null = null;
  try {
    const { getLivePrices } = await import("@/lib/market/price-provider");
    const live = await getLivePrices();
    liveStale = live.filter((quote) => quote.stale).length;
  } catch {
    liveStale = null;
  }
  const storedStale = (() => {
    const latest = new Map<string, string>();
    for (const row of price.data ?? []) {
      const instrument = String(row.instrument ?? "gold18");
      if (!latest.has(instrument)) latest.set(instrument, String(row.observed_at));
    }
    let stale = 0;
    for (const instrument of ["gold18", "silver925", "copper"]) {
      const observed = latest.get(instrument);
      const window = instrument === "copper" ? COPPER_STALE_AFTER_MS : SPOT_STALE_AFTER_MS;
      if (!observed || isTimestampStale(observed, window)) stale += 1;
    }
    return stale;
  })();

  const liabilityText = books
    ? `طلا ${(books.goldMg / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم · نقره ${(books.silverMg / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} · مس ${(books.copperMg / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })}`
    : null;

  return {
    connected: true as const,
    mode,
    flags,
    kills,
    ledgerReady,
    customers: {
      total: val(users.count ?? 0),
      kycVerified: val(kycV.count ?? 0),
      kycPending: val(kycP.count ?? 0),
      kycRejected: val(kycR.count ?? 0),
      newToday: val(newToday.count ?? 0),
      new7: val(new7.count ?? 0),
      new30: val(new30.count ?? 0),
    },
    trading: {
      tradesToday: val(buys.length + sells.length),
      buyVolumeToman: val(buys.reduce((sum, trade) => sum + trade.amount_toman, 0)),
      sellVolumeToman: val(sells.reduce((sum, trade) => sum + trade.amount_toman, 0)),
      goldVolumeMg: val(volume(todayTrades, "gold18")),
      silverVolumeMg: val(volume(todayTrades, "silver925")),
      copperVolumeMg: val(volume(todayTrades, "copper")),
      failedTrades: val(failed.length),
      expiredQuotes: expiredQuotes.error
        ? na(expiredQuotes.error.message)
        : val(expiredQuotes.count ?? 0),
    },
    money: {
      userIrrLiability: books ? val(books.liabilityToman) : ledgerNa,
      pendingDeposits: books ? val(books.reservedToman) : ledgerNa,
      pendingWithdrawals: val(todayJournals.filter((row) => row.type === "برداشت").length),
      pspClearing: na("درگاه PSP وصل نیست"),
      bankSettlement: na("تسویه بانکی وصل نیست"),
      controlledCash: platformAccounts.error
        ? na(platformAccounts.error.message)
        : cashToman == null
          ? na("مبلغ کنترل نقد از حد نمایش خارج است")
          : val(cashToman),
      depositsToday: val(todayJournals.filter((row) => row.type === "واریز").length),
      ledgerTomanAvailable: books ? val(books.availableToman) : ledgerNa,
    },
    metals: {
      customerGoldBookMg: books ? val(books.goldMg) : ledgerNa,
      customerSilverBookMg: books ? val(books.silverMg) : ledgerNa,
      customerCopperBookMg: books ? val(books.copperMg) : ledgerNa,
      customerGoldLiability: liabilityText ? val(liabilityText) : ledgerNa,
      availableTreasury: platformAccounts.error
        ? na(platformAccounts.error.message)
        : val(metalLine("PLATFORM_AVAILABLE") ?? "۰"),
      reservedInventory: platformAccounts.error
        ? na(platformAccounts.error.message)
        : val(metalLine("PLATFORM_RESERVED") ?? "۰"),
      custodyCoverage: na("CustodyProvider متصل نیست"),
    },
    operations: {
      reconMismatches: na("موتور تطبیق بانکی وصل نیست"),
      openIncidents: na("جدول حوادث اگر خالی باشد صفر جعلی نشان داده نمی‌شود"),
      failedProviderCalls: na("رجیستری خطای provider وجود ندارد"),
      outboxBacklog: outbox.error ? na(outbox.error.message) : val(outbox.count ?? 0),
      stalePrices: val(liveStale ?? storedStale),
      killSwitchesOff: Object.entries(kills)
        .filter(([, enabled]) => enabled === false)
        .map(([key]) => key),
      openTickets: val(tickets.count ?? 0),
      pendingKyc: val(pendingKyc.count ?? 0),
      banks: val(banks.data?.length ?? 0),
      dcaActive: val((dca.data ?? []).filter((row) => row.status === "ACTIVE").length),
      alertsActive: val((alerts.data ?? []).filter((row) => row.status === "ACTIVE").length),
    },
    latestPrices: price.data ?? [],
  };
}

export function metricText(m: Metric): string {
  if (m.kind === "unavailable") return UNAVAILABLE;
  return String(m.value);
}

export { KILL_SWITCH_KEYS } from "@/lib/core/mode";

/** Disabled flags are off. Only an unknown flag is NOT_READY. */
export function featureState(enabled: boolean | undefined, sandbox: boolean): OpsState {
  if (enabled === undefined) return "NOT_READY";
  if (!enabled) return "DEGRADED";
  return sandbox ? "SANDBOX" : "LIVE";
}
