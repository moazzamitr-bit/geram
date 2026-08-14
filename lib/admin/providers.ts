import type { OpsState } from "./status";
import { getExecutionMode } from "@/lib/core/mode";

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

export function listProviders(): ProviderRow[] {
  let mode: "SANDBOX" | "CLOSED_BETA" | "PRODUCTION" = "SANDBOX";
  try {
    mode = getExecutionMode();
  } catch {
    mode = "SANDBOX";
  }
  const sandbox = mode !== "PRODUCTION";
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

  return [
    mock("SMS", "OTP / SMS", "ارسال پیامک واقعی یکپارچه نشده"),
    mock("Identity", "National ID check", "استعلام هویت متصل نیست"),
    mock("Mobile Ownership", "Mobile ownership", "تأیید مالکیت خط متصل نیست"),
    mock("KYC", "KYC vendor", "فروشنده KYC این فاز نیست"),
    mock("Bank Account Verification", "IBAN ownership", "فقط فلگ verified محلی وجود دارد"),
    mock("Payment", "PSP deposit", "واریز واقعی PSP ساخته نشده؛ sandbox deposit جداست"),
    mock("Payout", "Bank payout", "برداشت واقعی ساخته نشده"),
    {
      group: "Market Data",
      name: "TGJU public",
      mode: sandbox ? "SANDBOX" : "DEGRADED",
      productionApproved: false,
      health: sandbox ? "SANDBOX" : "DEGRADED",
      lastSuccess: null,
      lastError: null,
      note: "منبع موقت عمومی؛ permittedForProduction=false مگر صریحاً تأیید شود",
    },
    mock("Custody", "CustodyProvider", "Milestone خزانه‌داری بعدی"),
    mock("Supplier", "Metal supplier", "Procurement هنوز اجرا نمی‌شود"),
    mock("Notification", "Transactional SMS/email", "فقط اعلان درون‌برنامه"),
    mock("Storage", "Document storage", "آپلود مدارک KYC فایل‌استور ندارد"),
  ];
}
