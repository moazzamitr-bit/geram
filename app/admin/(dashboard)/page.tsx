import {
  AdminBadge,
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
} from "@/components/admin/AdminUI";
import {
  getAdminOverview,
  listTransactions,
} from "@/lib/db/admin-queries";
import { formatToman } from "@/lib/utils";
import {
  Headphones,
  Landmark,
  LineChart,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const overview = await getAdminOverview();
  const txs = await listTransactions(8);

  return (
    <div>
      <AdminPageHeader
        title="داشبورد عملیات"
        description="نمای کلی کاربران، دارایی‌ها، تراکنش‌ها و وضعیت بازار از سوپابیس."
        action={
          <AdminBadge tone={overview.connected ? "positive" : "warning"}>
            {overview.connected ? "متصل به سوپابیس" : "بدون اتصال DB"}
          </AdminBadge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard
          label="کاربران"
          value={overview.users.toLocaleString("fa-IR")}
          icon={Users}
        />
        <AdminStatCard
          label="تراکنش‌ها"
          value={overview.transactions.toLocaleString("fa-IR")}
          icon={Landmark}
          tone="gold"
        />
        <AdminStatCard
          label="تیکت‌های باز"
          value={overview.openTickets.toLocaleString("fa-IR")}
          icon={Headphones}
          tone="warning"
        />
        <AdminStatCard
          label="طلای کل مشتریان"
          value={`${(overview.goldMg / 1000).toLocaleString("fa-IR", {
            maximumFractionDigits: 3,
          })} گرم`}
          icon={Wallet}
        />
        <AdminStatCard
          label="موجودی ریالی کیف‌ها"
          value={formatToman(overview.tomanAvailable)}
          icon={Wallet}
          tone="positive"
        />
        <AdminStatCard
          label="KYC در انتظار"
          value={overview.pendingKyc.toLocaleString("fa-IR")}
          icon={ShieldAlert}
          tone="warning"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">قیمت طلای ۱۸</h2>
            <LineChart size={18} className="text-gold" />
          </div>
          <p className="mt-4 text-[28px] font-extrabold tabular-nums text-gold">
            {overview.latestPrice != null
              ? formatToman(overview.latestPrice)
              : "—"}
          </p>
          <Link href="/admin/market" className="mt-4 inline-block text-[13px] text-gold">
            مدیریت بازار
          </Link>
        </div>
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">آخرین تراکنش‌ها</h2>
            <Link href="/admin/transactions" className="text-[13px] text-gold">
              همه
            </Link>
          </div>
          <AdminTable
            headers={["نوع", "کاربر", "مبلغ", "وضعیت", "تاریخ"]}
            empty={txs.length === 0}
          >
            {txs.map((tx) => {
              const profile = Array.isArray(tx.profiles)
                ? tx.profiles[0]
                : tx.profiles;
              return (
                <tr key={tx.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3.5 md:px-5">{tx.type}</td>
                  <td className="px-4 py-3.5 text-white/60 md:px-5">
                    {profile
                      ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                        profile.phone
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums md:px-5">
                    {formatToman(Number(tx.amount_toman))}
                  </td>
                  <td className="px-4 py-3.5 md:px-5">
                    <AdminBadge
                      tone={
                        String(tx.status).includes("انتظار")
                          ? "warning"
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
      </div>
    </div>
  );
}
