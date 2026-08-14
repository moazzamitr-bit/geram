import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/db/types";
import {
  getExecutionMode,
  getFeatureFlags,
  getKillSwitches,
} from "@/lib/core/mode";
import { UNAVAILABLE } from "./status";
import type { OpsState } from "./status";

export type Metric =
  | { kind: "value"; value: number | string }
  | { kind: "unavailable"; reason?: string };

function val(n: number | string): Metric {
  return { kind: "value", value: n };
}
function na(reason = "NOT READY"): Metric {
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

  if (!isSupabaseConfigured()) {
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
    txs,
    tickets,
    wallets,
    pendingKyc,
    price,
    banks,
    dca,
    alerts,
  ] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "VERIFIED"),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "PENDING"),
    sb.from("profiles").select("id", { count: "exact", head: true }).in("kyc_status", ["REJECTED", "NEEDS_UPDATE"]),
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", today),
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d7),
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d30),
    sb.from("transactions").select("id, type, instrument, gold_mg, amount_toman, status, created_at"),
    sb.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["OPEN", "WAITING_USER"]),
    sb.from("wallets").select("gold_mg, silver_mg, copper_mg, toman_available, toman_pending"),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "PENDING"),
    sb.from("market_prices").select("price_toman, instrument, observed_at, source").order("observed_at", { ascending: false }).limit(12),
    sb.from("bank_accounts").select("id, verified"),
    sb.from("scheduled_purchases").select("id, status"),
    sb.from("price_alerts").select("id, status"),
  ]);

  const txRows = txs.data ?? [];
  const todayTx = txRows.filter((t) => t.created_at >= today);
  const buys = todayTx.filter((t) => t.type === "خرید");
  const sells = todayTx.filter((t) => t.type === "فروش");
  const failed = txRows.filter((t) => String(t.status).includes("ناموفق"));
  const inst = (row: { instrument?: string; type?: string }) =>
    String(row.instrument ?? "gold18");

  const goldVol = todayTx
    .filter((t) => inst(t) === "gold18" || !t.instrument)
    .reduce((s, t) => s + Number(t.gold_mg || 0), 0);
  const silverVol = todayTx
    .filter((t) => inst(t) === "silver925")
    .reduce((s, t) => s + Number(t.gold_mg || 0), 0);
  const copperVol = todayTx
    .filter((t) => inst(t) === "copper")
    .reduce((s, t) => s + Number(t.gold_mg || 0), 0);

  const w = wallets.data ?? [];
  const goldBook = w.reduce((s, r) => s + Number(r.gold_mg || 0), 0);
  const silverBook = w.reduce((s, r) => s + Number((r as { silver_mg?: number }).silver_mg || 0), 0);
  const copperBook = w.reduce((s, r) => s + Number((r as { copper_mg?: number }).copper_mg || 0), 0);
  const toman = w.reduce((s, r) => s + Number(r.toman_available || 0), 0);
  const tomanPend = w.reduce((s, r) => s + Number(r.toman_pending || 0), 0);

  const depositsToday = todayTx.filter((t) => t.type === "واریز").length;
  const withdrawalsToday = todayTx.filter((t) => t.type === "برداشت").length;

  const stalePrice = (() => {
    const latest = price.data?.[0];
    if (!latest) return true;
    return Date.now() - new Date(latest.observed_at).getTime() > 15 * 60_000;
  })();

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
      buyVolumeToman: val(buys.reduce((s, t) => s + Number(t.amount_toman || 0), 0)),
      sellVolumeToman: val(sells.reduce((s, t) => s + Number(t.amount_toman || 0), 0)),
      goldVolumeMg: val(goldVol),
      silverVolumeMg: val(silverVol),
      copperVolumeMg: val(copperVol),
      failedTrades: val(failed.length),
      expiredQuotes: na("جدول quote هنوز روی این دیتابیس نیست"),
    },
    money: {
      userIrrLiability: ledgerReady ? na("دفترکل عملیاتی مهاجرت نشده") : na("Postgres دفترکل متصل نیست"),
      pendingDeposits: val(tomanPend),
      pendingWithdrawals: val(withdrawalsToday),
      pspClearing: na("PSP هنوز یکپارچه نشده"),
      bankSettlement: na("تسویه بانکی هنوز یکپارچه نشده"),
      controlledCash: na("PLATFORM_CASH_CONTROL روی این محیط موجود نیست"),
      depositsToday: val(depositsToday),
      legacyTomanBook: val(toman),
    },
    metals: {
      customerGoldBookMg: val(goldBook),
      customerSilverBookMg: val(silverBook),
      customerCopperBookMg: val(copperBook),
      customerGoldLiability: na("CustomerMetalLiability در milestone خزانه‌داری نیست"),
      availableTreasury: na("CORE_MILESTONE_PLACEHOLDER"),
      reservedInventory: na("رزرو فلز در این دیتابیس موجود نیست"),
      custodyCoverage: na("CustodyProvider متصل نیست"),
    },
    operations: {
      reconMismatches: na("موتور تطبیق هنوز فعال نیست"),
      openIncidents: na("جدول حوادث عملیاتی خالی/غیرفعال"),
      failedProviderCalls: na("رجیستری خطاهای provider موجود نیست"),
      outboxBacklog: ledgerReady ? na("core_outbox روی Supabase اعمال نشده") : na("دفترکل Postgres نیست"),
      stalePrices: val(stalePrice ? 1 : 0),
      killSwitchesOff: Object.entries(kills)
        .filter(([, v]) => v === false)
        .map(([k]) => k),
      openTickets: val(tickets.count ?? 0),
      pendingKyc: val(pendingKyc.count ?? 0),
      banks: val(banks.data?.length ?? 0),
      dcaActive: val((dca.data ?? []).filter((x) => x.status === "ACTIVE").length),
      alertsActive: val((alerts.data ?? []).filter((x) => x.status === "ACTIVE").length),
    },
    latestPrices: price.data ?? [],
  };
}

export function metricText(m: Metric): string {
  if (m.kind === "unavailable") return UNAVAILABLE;
  return String(m.value);
}

export { KILL_SWITCH_KEYS } from "@/lib/core/mode";

export function featureState(enabled: boolean | undefined, sandbox: boolean): OpsState {
  if (enabled === undefined) return "NOT_READY";
  if (!enabled) return "NOT_READY";
  return sandbox ? "SANDBOX" : "LIVE";
}
