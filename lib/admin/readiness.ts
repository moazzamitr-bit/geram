import { finnotechConfigured } from "@/lib/finnotech/config";
import { getExecutionMode, getKillSwitches, postgresRequired } from "@/lib/core/mode";
import { isSupabaseConfigured } from "@/lib/db/types";
import type { MarketPriceQuote } from "@/lib/market/price-provider";
import { probeTable } from "./probe";
import { listProviders } from "./providers";

export type ReadyStatus = "READY" | "DEGRADED" | "NOT_READY";

export type ReadySection = {
  id: string;
  title: string;
  status: ReadyStatus;
  blockers: string[];
};

export type ReadinessEvidence = {
  tables?: Partial<
    Record<
      | "core_ledger_accounts"
      | "core_journals"
      | "core_trades"
      | "core_quotes"
      | "market_prices"
      | "core_outbox",
      boolean
    >
  >;
  finnotech?: boolean;
  prices?: Pick<MarketPriceQuote, "instrument" | "stale">[];
};

const LEDGER_TABLES = [
  "core_ledger_accounts",
  "core_journals",
  "core_trades",
  "core_quotes",
  "market_prices",
] as const;

function priceBlocker(
  prices: ReadinessEvidence["prices"],
  instrument: "gold18" | "silver925" | "copper",
  label: string
) {
  const row = prices?.find((price) => price.instrument === instrument);
  if (!row) return `قیمت ${label} در این درخواست خوانده نشد`;
  if (row.stale) return `قیمت ${label} کهنه است`;
  return null;
}

export function computeReleaseReadiness(evidence: ReadinessEvidence = {}): ReadySection[] {
  let mode: ReturnType<typeof getExecutionMode> | null = null;
  try {
    mode = getExecutionMode();
  } catch {
    mode = null;
  }
  const kills = getKillSwitches();
  const dbUrl = Boolean(
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL
  );
  const supabase = isSupabaseConfigured();
  const service = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const providers = listProviders({ finnotech: evidence.finnotech, prices: evidence.prices });
  const anyMockProd = providers.some((provider) => provider.mode === "MOCK" && provider.productionApproved);
  const tables = evidence.tables;
  const ledgerPresent = tables
    ? LEDGER_TABLES.every((name) => tables[name] === true)
    : false;

  const databaseBlockers = [
    ...(supabase ? [] : ["Supabase URL/anon تنظیم نشده"]),
    ...(service ? [] : ["SUPABASE_SERVICE_ROLE_KEY نیست"]),
    ...(dbUrl || !postgresRequired(mode ?? "SANDBOX") ? [] : ["DATABASE_URL برای دفترکل عملیاتی نیست"]),
    ...(tables
      ? ledgerPresent
        ? []
        : ["یکی از جدول‌های دفترکل در دسترس نیست"]
      : ["وجود جدول‌های دفترکل در این درخواست بررسی نشد"]),
  ];

  const finnotech = evidence.finnotech === true;
  const quoteNotes = (["gold18", "silver925", "copper"] as const).map((instrument) =>
    priceBlocker(evidence.prices, instrument, instrument === "gold18" ? "طلا" : instrument === "silver925" ? "نقره" : "مس")
  );
  const missingQuotes = quoteNotes.filter((note): note is string => note != null);
  const quotesFresh = (evidence.prices?.length ?? 0) > 0 && missingQuotes.length === 0;

  const sections: ReadySection[] = [
    {
      id: "CODE",
      title: "CODE",
      status: "READY",
      blockers: [],
    },
    {
      id: "DATABASE",
      title: "DATABASE",
      status: databaseBlockers.length === 0 ? "READY" : ledgerPresent && supabase ? "DEGRADED" : "NOT_READY",
      blockers: databaseBlockers,
    },
    {
      id: "SECURITY",
      title: "SECURITY",
      status: "DEGRADED",
      blockers: ["مرکز نشست/دستگاه کامل نیست", "step-up OTP ادمین پیاده نشده"],
    },
    {
      id: "IDENTITY",
      title: "IDENTITY",
      status: "DEGRADED",
      blockers: ["ورود ادمین با ایمیل/رمز است؛ OTP ادمین نیست"],
    },
    {
      id: "KYC",
      title: "KYC",
      status: finnotech ? "READY" : "NOT_READY",
      blockers: finnotech
        ? []
        : ["Finnotech تنظیم نشده (FINNOTECH_CLIENT_ID، FINNOTECH_CLIENT_SECRET، FINNOTECH_NID)"],
    },
    {
      id: "PAYMENTS",
      title: "PAYMENTS",
      status: "NOT_READY",
      blockers: ["درگاه PSP وصل نیست. شارژ و برگشت فقط با ژورنال دفترکل ثبت می‌شود."],
    },
    {
      id: "PAYOUTS",
      title: "PAYOUTS",
      status: "NOT_READY",
      blockers: [
        "پرداخت بانکی پیاده‌سازی نشده",
        kills.WITHDRAWAL_ENABLED
          ? "کلید WITHDRAWAL_ENABLED روشن است ولی workflow بانکی نیست"
          : "برداشت بانکی از kill switch خاموش است",
      ],
    },
    {
      id: "MARKET_DATA",
      title: "MARKET_DATA",
      status: quotesFresh ? "DEGRADED" : "NOT_READY",
      blockers: [
        "TGJU منبع موقت عمومی است و permittedForProduction=false",
        ...missingQuotes,
      ],
    },
    {
      id: "TREASURY",
      title: "TREASURY",
      status: tables?.core_ledger_accounts ? "DEGRADED" : "NOT_READY",
      blockers: tables?.core_ledger_accounts
        ? ["موجودی قابل فروش از PLATFORM_AVAILABLE خوانده می‌شود. پوشش حضانت جداست."]
        : ["جدول core_ledger_accounts در دسترس نیست"],
    },
    {
      id: "CUSTODY",
      title: "CUSTODY",
      status: "NOT_READY",
      blockers: ["CustodyProvider متصل نیست"],
    },
    {
      id: "E2E",
      title: "E2E",
      status: "NOT_READY",
      blockers: ["سناریوی پرداخت واقعی end-to-end وجود ندارد"],
    },
    {
      id: "LEGAL_REGULATORY",
      title: "LEGAL_REGULATORY",
      status: "NOT_READY",
      blockers: ["این بخش از شواهد سیستم مشتق نمی‌شود و دستی READY نمی‌شود"],
    },
  ];
  return sections.map((section): ReadySection => {
    if (anyMockProd && section.id === "PAYMENTS") {
      return { ...section, status: "NOT_READY", blockers: [...section.blockers, "Mock نباید production-ready باشد"] };
    }
    return section;
  });
}

const PROBE_TABLES = [
  "core_ledger_accounts",
  "core_journals",
  "core_trades",
  "core_quotes",
  "market_prices",
  "core_outbox",
] as const;

export async function loadReleaseReadiness(): Promise<ReadySection[]> {
  const tables: NonNullable<ReadinessEvidence["tables"]> = {};
  await Promise.all(
    PROBE_TABLES.map(async (name) => {
      const probed = await probeTable(name, "id", { limit: 1 });
      tables[name] = probed.ready;
    })
  );
  let prices: MarketPriceQuote[] = [];
  try {
    const { getLivePrices } = await import("@/lib/market/price-provider");
    prices = await getLivePrices();
  } catch {
    prices = [];
  }
  return computeReleaseReadiness({
    tables,
    finnotech: finnotechConfigured(),
    prices,
  });
}
