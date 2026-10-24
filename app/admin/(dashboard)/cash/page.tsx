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
          label="بدهی تومان مشتری (دفترکل)"
          value={ops.connected && ops.money.userIrrLiability.kind === "value" ? formatToman(Number(ops.money.userIrrLiability.value)) : ""}
          unavailable={!ops.connected || ops.money.userIrrLiability.kind !== "value"}
          hint="USER_AVAILABLE به‌علاوه USER_RESERVED"
          icon={Wallet}
        />
        <AdminStatCard
          label="تومان رزرو (دفترکل)"
          value={ops.connected && ops.money.pendingDeposits.kind === "value" ? formatToman(Number(ops.money.pendingDeposits.value)) : ""}
          unavailable={!ops.connected || ops.money.pendingDeposits.kind !== "value"}
          icon={Wallet}
        />
        <AdminStatCard
          label="تومان قابل استفاده (دفترکل)"
          value={ops.connected && ops.money.ledgerTomanAvailable.kind === "value" ? formatToman(Number(ops.money.ledgerTomanAvailable.value)) : ""}
          unavailable={!ops.connected || ops.money.ledgerTomanAvailable.kind !== "value"}
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
