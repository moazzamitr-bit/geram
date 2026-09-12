import {
  AdminBadge,
  AdminGuide,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { adminPageGuides } from "@/lib/admin/page-guides";
import { listTransactions } from "@/lib/db/admin-queries";
import { formatToman } from "@/lib/utils";

export default async function AdminTransactionsPage() {
  const rows = await listTransactions(100);
  const guide = adminPageGuides.transactions;

  return (
    <div>
      <AdminPageHeader
        title={guide.title}
        description="لاگ خرید، فروش، واریز، برداشت و تحویل با کد پیگیری."
      />
      <AdminGuide
        purpose={guide.purpose}
        whenToUse={guide.whenToUse}
        sandboxNote={guide.sandboxNote}
      />
      <AdminTable
        headers={["کد", "نوع", "کاربر", "طلا", "مبلغ", "وضعیت", "زمان"]}
        empty={rows.length === 0}
      >
        {rows.map((tx) => {
          const profile = Array.isArray(tx.profiles) ? tx.profiles[0] : tx.profiles;
          return (
            <tr key={tx.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3.5 font-mono text-[12px] md:px-5" dir="ltr">
                {tx.tracking_code}
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
