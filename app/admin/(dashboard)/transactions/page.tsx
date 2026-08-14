import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listTransactions } from "@/lib/db/admin-queries";
import { formatToman } from "@/lib/utils";
import Link from "next/link";

export default async function AdminTransactionsPage() {
  const rows = await listTransactions(100);

  return (
    <div>
      <AdminPageHeader
        title="تراکنش‌ها"
        description="فهرست میراث. برای معامله از صفحه Trades و برای دفترکل از Ledger استفاده کنید."
      />
      <AdminNotice title="منبع">جدول transactions — نه core_journals.</AdminNotice>
      <AdminTable
        headers={["کد", "نوع", "کاربر", "طلا", "مبلغ", "وضعیت", "زمان"]}
        empty={rows.length === 0}
      >
        {rows.map((tx) => {
          const profile = Array.isArray(tx.profiles) ? tx.profiles[0] : tx.profiles;
          return (
            <tr key={tx.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3.5 font-mono text-[12px] md:px-5" dir="ltr">
                <Link className="text-gold" href={`/admin/trades/${tx.id}`}>{tx.tracking_code}</Link>
              </td>
              <td className="px-4 py-3.5 md:px-5">{tx.type}</td>
              <td className="px-4 py-3.5 text-white/60 md:px-5">
                {profile
                  ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                    profile.phone
                  : "—"}
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {(Number(tx.gold_mg) / 1000).toLocaleString("fa-IR", {
                  maximumFractionDigits: 3,
                })}
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {formatToman(Number(tx.amount_toman))}
              </td>
              <td className="px-4 py-3.5 md:px-5">
                <AdminBadge
                  tone={
                    String(tx.status).includes("انتظار") ||
                    String(tx.status).includes("پردازش")
                      ? "warning"
                      : String(tx.status).includes("ناموفق")
                        ? "negative"
                        : "positive"
                  }
                >
                  {tx.status}
                </AdminBadge>
              </td>
              <td className="px-4 py-3.5 text-white/45 md:px-5">
                {new Date(tx.created_at).toLocaleString("fa-IR")}
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
