import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { WalletCreditForm } from "@/components/admin/WalletCreditForm";
import { listTransactionsFiltered } from "@/lib/admin/queries";
import { formatToman } from "@/lib/utils";
import { maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

export default async function AdminDepositsPage() {
  const rows = await listTransactionsFiltered({ type: "واریز", limit: 200 });

  return (
    <div>
      <AdminPageHeader
        title="صف واریز"
        description="واریز شخصی خاموش است. شارژ کیف پول با ژورنال دفترکل به USER_AVAILABLE می‌نشیند."
        action={<a className="text-[13px] text-gold" href="/api/admin/export?type=deposits">CSV</a>}
      />
      <AdminNotice title="شارژ دستی">
        درگاه بانکی وصل نیست. برای بتای بسته، فرم شارژ را ثبت کنید تا دفترکل بلافاصله موجودی قابل استفاده را یک‌بار زیاد کند. جدول wallets مستقیم تغییر نمی‌کند. خرید مشتری تا وقتی فلز در PLATFORM_AVAILABLE نباشد رد می‌شود.
      </AdminNotice>
      <div className="mb-6 max-w-lg">
        <WalletCreditForm />
      </div>
      <AdminTable headers={["کد", "کاربر", "مبلغ", "وضعیت", "رفرنس", "زمان", "اقدام"]} empty={rows.length === 0}>
        {rows.map((t) => {
          const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
          return (
            <tr key={t.id} className="border-b border-white/5 align-top">
              <td className="px-4 py-3 font-mono text-[12px]">{t.tracking_code}</td>
              <td className="px-4 py-3">
                <Link className="text-gold" href={`/admin/users/${t.user_id}`}>
                  {profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone) : "—"}
                </Link>
              </td>
              <td className="px-4 py-3">{formatToman(Number(t.amount_toman))}</td>
              <td className="px-4 py-3"><AdminBadge tone="warning">{t.status}</AdminBadge></td>
              <td className="px-4 py-3 font-mono text-[12px]">{t.payment_ref ?? "—"}</td>
              <td className="px-4 py-3 text-white/45">{new Date(t.created_at).toLocaleString("fa-IR")}</td>
              <td className="px-4 py-3 min-w-[220px]">
                <AdminActionForm
                  action="create"
                  endpoint="/api/admin/incidents"
                  extra={{ kind: "PAYMENT_MISMATCH", correlationId: t.id }}
                  submitLabel="علامت تحقیق دستی"
                />
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
