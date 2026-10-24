import { finnotechConfigured } from "@/lib/finnotech/config";
import { getExecutionMode } from "@/lib/core/mode";
import type { MarketPriceQuote } from "@/lib/market/price-provider";
import type { OpsState } from "./status";

export type ProviderRow = {
  group: string;
  name: string;
  mode: OpsState;
  productionApproved: boolean;
  health: OpsState;
  lastSuccess: string | null;
  lastError: string | null;
  note: string;
};

export function listProviders(opts?: {
  finnotech?: boolean;
  prices?: (Pick<MarketPriceQuote, "instrument" | "stale"> &
    Partial<Pick<MarketPriceQuote, "source" | "updatedAt">>)[];
}): ProviderRow[] {
  let mode: "SANDBOX" | "CLOSED_BETA" | "PRODUCTION" = "SANDBOX";
  try {
    mode = getExecutionMode();
  } catch {
    mode = "SANDBOX";
  }
  const finnotech = opts?.finnotech ?? finnotechConfigured();
  const mock = (group: string, name: string, note: string): ProviderRow => ({
    group,
    name,
    mode: "MOCK",
    productionApproved: false,
    health: "NOT_READY",
    lastSuccess: null,
    lastError: null,
    note,
  });
  const configured = (group: string, name: string, note: string): ProviderRow => ({
    group,
    name,
    mode: "LIVE",
    productionApproved: false,
    health: "LIVE",
    lastSuccess: null,
    lastError: null,
    note,
  });

  const prices = opts?.prices ?? [];
  const staleCount = prices.filter((price) => price.stale).length;
  const marketHealth: OpsState =
    prices.length === 0 ? "DEGRADED" : staleCount > 0 ? "DEGRADED" : "LIVE";
  const marketNote =
    prices.length === 0
      ? "قیمت لایو در این درخواست خوانده نشد. TGJU منبع موقت است و permittedForProduction=false."
      : `TGJU · ${prices.map((price) => `${price.instrument}${price.stale ? " کهنه" : " تازه"}`).join("، ")} · permittedForProduction=false`;

  return [
    finnotech
      ? configured("SMS", "OTP / SMS", "Finnotech messaging یا finnotext")
      : mock("SMS", "OTP / SMS", "Finnotech تنظیم نشده"),
    finnotech
      ? configured("Identity", "National ID check", "استعلام هویت Finnotech")
      : mock("Identity", "National ID check", "Finnotech تنظیم نشده"),
    finnotech
      ? configured("Mobile Ownership", "Mobile ownership", "شاهکار Finnotech")
      : mock("Mobile Ownership", "Mobile ownership", "Finnotech تنظیم نشده"),
    finnotech
      ? configured("KYC", "Finnotech KYC", "client id، secret و NID تنظیم شده‌اند")
      : {
          ...mock("KYC", "Finnotech KYC", "FINNOTECH_CLIENT_ID / SECRET / NID تنظیم نشده"),
          mode: "NOT_READY",
        },
    mock("Bank Account Verification", "IBAN ownership", "فقط فلگ verified محلی وجود دارد"),
    mock("Payment", "PSP deposit", "درگاه PSP ساخته نشده. شارژ از ژورنال دفترکل است."),
    mock("Payout", "Bank payout", "برداشت بانکی ساخته نشده"),
    {
      group: "Market Data",
      name: "TGJU public",
      mode: mode === "PRODUCTION" ? "DEGRADED" : marketHealth === "LIVE" ? "LIVE" : "DEGRADED",
      productionApproved: false,
      health: marketHealth,
      lastSuccess: prices.find((price) => !price.stale)?.updatedAt ?? null,
      lastError: null,
      note: marketNote,
    },
    mock("Custody", "CustodyProvider", "حضانت فیزیکی متصل نیست"),
    mock("Supplier", "Metal supplier", "Procurement هنوز اجرا نمی‌شود"),
    mock("Notification", "Transactional SMS/email", "فقط اعلان درون‌برنامه"),
    mock("Storage", "Document storage", "آپلود مدارک KYC فایل‌استور ندارد"),
  ];
}
