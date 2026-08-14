import { getExecutionMode, getFeatureFlags, getKillSwitches, postgresRequired } from "@/lib/core/mode";
import { isSupabaseConfigured } from "@/lib/db/types";
import { listProviders } from "./providers";

export type ReadyStatus = "READY" | "DEGRADED" | "NOT_READY";

export type ReadySection = {
  id: string;
  title: string;
  status: ReadyStatus;
  blockers: string[];
};

export function computeReleaseReadiness(): ReadySection[] {
  let mode: ReturnType<typeof getExecutionMode> | null = null;
  try {
    mode = getExecutionMode();
  } catch {
    mode = null;
  }
  const flags = mode ? getFeatureFlags(mode) : null;
  const kills = getKillSwitches();
  const dbUrl = Boolean(
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL
  );
  const supabase = isSupabaseConfigured();
  const service = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const providers = listProviders();
  const anyMockProd = providers.some((p) => p.mode === "MOCK" && p.productionApproved);

  return [
    {
      id: "CODE",
      title: "CODE",
      status: "READY",
      blockers: [],
    },
    {
      id: "DATABASE",
      title: "DATABASE",
      status: supabase && service ? (dbUrl || !postgresRequired(mode ?? "SANDBOX") ? "DEGRADED" : "DEGRADED") : "NOT_READY",
      blockers: [
        ...(supabase ? [] : ["Supabase URL/anon تنظیم نشده"]),
        ...(service ? [] : ["SUPABASE_SERVICE_ROLE_KEY نیست"]),
        ...(dbUrl ? [] : ["DATABASE_URL برای دفترکل عملیاتی نیست"]),
        "جدول‌های financial core روی این پروژه Supabase اعمال نشده‌اند",
      ],
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
      status: "NOT_READY",
      blockers: ["فروشنده KYC متصل نیست", "تأیید دستی فقط با سیاست و audit"],
    },
    {
      id: "PAYMENTS",
      title: "PAYMENTS",
      status: "NOT_READY",
      blockers: ["PSP واقعی نیست", flags?.SANDBOX_DEPOSIT_ENABLED ? "واریز sandbox فقط شبیه‌سازی است" : "واریز sandbox هم خاموش است"],
    },
    {
      id: "PAYOUTS",
      title: "PAYOUTS",
      status: "NOT_READY",
      blockers: ["پرداخت بانکی پیاده‌سازی نشده", kills.WITHDRAWAL_ENABLED ? "کلید WITHDRAWAL_ENABLED روشن است ولی workflow نیست" : "برداشت از kill switch خاموش است"],
    },
    {
      id: "MARKET_DATA",
      title: "MARKET_DATA",
      status: mode === "PRODUCTION" ? "NOT_READY" : "DEGRADED",
      blockers: ["TGJU منبع موقت عمومی است", "permittedForProduction پیش‌فرض false"],
    },
    {
      id: "TREASURY",
      title: "TREASURY",
      status: "NOT_READY",
      blockers: ["CORE_MILESTONE_PLACEHOLDER", "CustomerMetalLiability محاسبه نمی‌شود"],
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
  ].map((s): ReadySection => {
    if (anyMockProd && s.id === "PAYMENTS") {
      return { ...s, status: "NOT_READY", blockers: [...s.blockers, "Mock نباید production-ready باشد"] };
    }
    return s as ReadySection;
  });
}
