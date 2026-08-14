import {
  AdminNotice,
  AdminPageHeader,
  AdminStatCard,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { loadDashboardOps } from "@/lib/admin/ops";
import { formatToman } from "@/lib/utils";
import { Landmark, Wallet } from "lucide-react";

export default async function AdminCashPage() {
  const ops = await loadDashboardOps();
  return (
    <div>
      <AdminPageHeader
        title="موقعیت نقد"
        description="کنترل نقد داخلی با موجودی واقعی بانک یکی نیست."
      />
      <OpsBadge state="NOT_READY" />
      <AdminNotice title="برچسب‌ها">
        «کنترل نقد داخلی» = PLATFORM_CASH_CONTROL دفتری. «موجودی واقعی بانک» تا زمان اتصال صورت‌حساب خارجی UNAVAILABLE است.
      </AdminNotice>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard
          label="بدهی IRR مشتری (ledger)"
          value=""
          unavailable
          hint="دفترکل عملیاتی مهاجرت نشده"
          icon={Wallet}
        />
        <AdminStatCard
          label="IRR رزرو کاربر"
          value=""
          unavailable
          hint="حساب رزرو دفترکل نیست"
          icon={Wallet}
        />
        <AdminStatCard
          label="تومان دفتری wallets (میراث)"
          value={ops.connected && ops.money.legacyTomanBook.kind === "value" ? formatToman(Number(ops.money.legacyTomanBook.value)) : ""}
          unavailable={!ops.connected || ops.money.legacyTomanBook.kind !== "value"}
          icon={Wallet}
        />
        <AdminStatCard label="PAYMENT_GATEWAY_CLEARING" value="" unavailable hint="PSP یکپارچه نشده" icon={Landmark} />
        <AdminStatCard label="BANK_SETTLEMENT_CLEARING" value="" unavailable hint="تسویه بانکی نیست" icon={Landmark} />
        <AdminStatCard label="کنترل نقد داخلی" value="" unavailable hint="PLATFORM_CASH_CONTROL زنده نیست" icon={Wallet} />
        <AdminStatCard label="موجودی واقعی بانک" value="" unavailable hint="شواهد بانکی خارجی نیست" icon={Landmark} />
      </div>
    </div>
  );
}
