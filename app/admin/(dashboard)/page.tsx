import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminStatCard,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { loadDashboardOps, metricText } from "@/lib/admin/ops";
import { formatToman } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Landmark,
  LineChart,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

function Card({
  label,
  metric,
  icon,
  format,
  tone,
}: {
  label: string;
  metric: { kind: "value"; value: number | string } | { kind: "unavailable"; reason?: string };
  icon: typeof Users;
  format?: (n: number) => string;
  tone?: "default" | "gold" | "positive" | "warning";
}) {
  if (metric.kind === "unavailable") {
    return (
      <AdminStatCard
        label={label}
        value=""
        unavailable
        hint={metric.reason}
        icon={icon}
        tone="warning"
      />
    );
  }
  const raw = metric.value;
  const display =
    typeof raw === "number" && format ? format(raw) : typeof raw === "number" ? raw.toLocaleString("fa-IR") : String(raw);
  return <AdminStatCard label={label} value={display} icon={icon} tone={tone} />;
}

export default async function AdminDashboardPage() {
  const ops = await loadDashboardOps();

  return (
    <div>
      <AdminPageHeader
        title="داشبورد عملیات"
        description="شاخص‌های واقعی از سوپابیس. مقادیر دفترکل/خزانه/PSP اگر پیاده نشده باشند نمایش داده نمی‌شوند."
        action={
          <div className="flex flex-wrap gap-2">
            <AdminBadge tone={ops.connected ? "positive" : "warning"}>
              {ops.connected ? "سوپابیس متصل" : "بدون DB"}
            </AdminBadge>
            {ops.mode ? <OpsBadge state={ops.mode === "PRODUCTION" ? "LIVE" : "SANDBOX"} /> : (
              <AdminBadge tone="warning">MODE نامشخص</AdminBadge>
            )}
          </div>
        }
      />

      {!ops.connected ? (
        <AdminNotice title="اتصال دیتابیس برقرار نیست">
          کارت‌ها صفر جعلی نشان نمی‌دهند. پس از اتصال سوپابیس داده‌های واقعی می‌آیند.
        </AdminNotice>
      ) : null}

      <h2 className="mb-3 text-[14px] font-bold text-white/70">مشتریان</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="کل کاربران" metric={ops.connected ? ops.customers.total : { kind: "unavailable" }} icon={Users} />
        <Card label="KYC تأییدشده" metric={ops.connected ? ops.customers.kycVerified : { kind: "unavailable" }} icon={Users} tone="positive" />
        <Card label="KYC در انتظار" metric={ops.connected ? ops.customers.kycPending : { kind: "unavailable" }} icon={ShieldAlert} tone="warning" />
        <Card label="رد / نیاز به اصلاح" metric={ops.connected ? ops.customers.kycRejected : { kind: "unavailable" }} icon={ShieldAlert} tone="warning" />
        <Card label="کاربر جدید امروز" metric={ops.connected ? ops.customers.newToday : { kind: "unavailable" }} icon={Users} />
        <Card label="۷ روز" metric={ops.connected ? ops.customers.new7 : { kind: "unavailable" }} icon={Users} />
        <Card label="۳۰ روز" metric={ops.connected ? ops.customers.new30 : { kind: "unavailable" }} icon={Users} />
      </div>

      <h2 className="mb-3 mt-8 text-[14px] font-bold text-white/70">معاملات (دفتر میراث transactions)</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="معامله امروز" metric={ops.connected ? ops.trading.tradesToday : { kind: "unavailable" }} icon={Landmark} tone="gold" />
        <Card label="حجم خرید امروز" metric={ops.connected ? ops.trading.buyVolumeToman : { kind: "unavailable" }} icon={Landmark} format={formatToman} />
        <Card label="حجم فروش امروز" metric={ops.connected ? ops.trading.sellVolumeToman : { kind: "unavailable" }} icon={Landmark} format={formatToman} />
        <Card label="حجم طلا امروز" metric={ops.connected ? ops.trading.goldVolumeMg : { kind: "unavailable" }} icon={Wallet} format={(n) => `${(n / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم`} />
        <Card label="حجم نقره امروز" metric={ops.connected ? ops.trading.silverVolumeMg : { kind: "unavailable" }} icon={Wallet} format={(n) => `${(n / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم`} />
        <Card label="حجم مس امروز" metric={ops.connected ? ops.trading.copperVolumeMg : { kind: "unavailable" }} icon={Wallet} format={(n) => `${(n / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم`} />
        <Card label="معاملات ناموفق" metric={ops.connected ? ops.trading.failedTrades : { kind: "unavailable" }} icon={AlertTriangle} tone="warning" />
        <Card label="نقل‌قول منقضی" metric={ops.connected ? ops.trading.expiredQuotes : { kind: "unavailable" }} icon={AlertTriangle} />
      </div>

      <h2 className="mb-3 mt-8 text-[14px] font-bold text-white/70">پول</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card label="بدهی IRR مشتری (دفترکل)" metric={ops.connected ? ops.money.userIrrLiability : { kind: "unavailable" }} icon={Wallet} />
        <Card label="تومان دفتری wallets (میراث)" metric={ops.connected ? ops.money.legacyTomanBook : { kind: "unavailable" }} icon={Wallet} format={formatToman} tone="positive" />
        <Card label="تومان در انتظار" metric={ops.connected ? ops.money.pendingDeposits : { kind: "unavailable" }} icon={Wallet} format={formatToman} tone="warning" />
        <Card label="PSP clearing" metric={ops.connected ? ops.money.pspClearing : { kind: "unavailable" }} icon={Landmark} />
        <Card label="تسویه بانک" metric={ops.connected ? ops.money.bankSettlement : { kind: "unavailable" }} icon={Landmark} />
        <Card label="کنترل نقد داخلی" metric={ops.connected ? ops.money.controlledCash : { kind: "unavailable" }} icon={Wallet} />
      </div>

      <h2 className="mb-3 mt-8 text-[14px] font-bold text-white/70">فلزات</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card label="طلای دفتری wallets" metric={ops.connected ? ops.metals.customerGoldBookMg : { kind: "unavailable" }} icon={Wallet} format={(n) => `${(n / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم`} tone="gold" />
        <Card label="نقره دفتری wallets" metric={ops.connected ? ops.metals.customerSilverBookMg : { kind: "unavailable" }} icon={Wallet} format={(n) => `${(n / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم`} />
        <Card label="مس دفتری wallets" metric={ops.connected ? ops.metals.customerCopperBookMg : { kind: "unavailable" }} icon={Wallet} format={(n) => `${(n / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم`} />
        <Card label="بدهی فلز مشتری (ledger)" metric={ops.connected ? ops.metals.customerGoldLiability : { kind: "unavailable" }} icon={AlertTriangle} />
        <Card label="موجودی خزانه قابل فروش" metric={ops.connected ? ops.metals.availableTreasury : { kind: "unavailable" }} icon={Wallet} />
        <Card label="پوشش حضانت" metric={ops.connected ? ops.metals.custodyCoverage : { kind: "unavailable" }} icon={ShieldAlert} />
      </div>

      <h2 className="mb-3 mt-8 text-[14px] font-bold text-white/70">عملیات</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card label="عدم تطبیق باز" metric={ops.connected ? ops.operations.reconMismatches : { kind: "unavailable" }} icon={Activity} />
        <Card label="حوادث باز" metric={ops.connected ? ops.operations.openIncidents : { kind: "unavailable" }} icon={AlertTriangle} />
        <Card label="خطای provider" metric={ops.connected ? ops.operations.failedProviderCalls : { kind: "unavailable" }} icon={Activity} />
        <Card label="صف outbox" metric={ops.connected ? ops.operations.outboxBacklog : { kind: "unavailable" }} icon={Activity} />
        <Card label="قیمت کهنه" metric={ops.connected ? ops.operations.stalePrices : { kind: "unavailable" }} icon={LineChart} tone="warning" />
        <Card label="تیکت باز" metric={ops.connected ? ops.operations.openTickets : { kind: "unavailable" }} icon={Users} tone="warning" />
      </div>

      {ops.connected && ops.operations.killSwitchesOff.length > 0 ? (
        <p className="mt-4 text-[13px] text-warning">
          کلیدهای خاموش: {ops.operations.killSwitchesOff.join("، ")}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3 text-[13px]">
        <Link className="text-gold" href="/admin/readiness">آمادگی انتشار</Link>
        <Link className="text-gold" href="/admin/health">سلامت عملیات</Link>
        <Link className="text-gold" href="/admin/kyc">صف KYC</Link>
        <Link className="text-gold" href="/admin/trades">معاملات</Link>
      </div>
    </div>
  );
}
