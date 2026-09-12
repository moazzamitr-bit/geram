import {
  AdminBadge,
  AdminGuide,
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
} from "@/components/admin/AdminUI";
import { adminPageGuides } from "@/lib/admin/page-guides";
import {
  getTreasuryDashboard,
  listTreasuryTrades,
} from "@/lib/db/treasury-queries";
import { formatToman } from "@/lib/utils";
import { BadgeDollarSign, Coins, TrendingUp, Warehouse } from "lucide-react";

export default async function AdminPnlPage() {
  const guide = adminPageGuides.pnl;
  const [dash, trades] = await Promise.all([
    getTreasuryDashboard("GOLD"),
    listTreasuryTrades(80),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={guide.title}
        description="اسپرد جدا از کارمزد است. COGS از WAC روی خرید مشتری محاسبه می‌شود."
      />
      <AdminGuide purpose={guide.purpose} whenToUse={guide.whenToUse} />

      {dash.connected && "period" in dash ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="درآمد اسپرد (۳۰ روز)"
            value={formatToman(dash.period.spreadRevenueToman)}
            icon={TrendingUp}
            tone="gold"
          />
          <AdminStatCard
            label="درآمد کارمزد (۳۰ روز)"
            value={formatToman(dash.period.feeRevenueToman)}
            icon={BadgeDollarSign}
          />
          <AdminStatCard
            label="P&L تحقق‌یافته"
            value={formatToman(dash.period.realizedPnlToman)}
            hint="پس از کسر هزینه عملیاتی"
            icon={Coins}
            tone={dash.period.realizedPnlToman >= 0 ? "positive" : "warning"}
          />
          <AdminStatCard
            label="P&L تحقق‌نیافته"
            value={formatToman(dash.period.unrealizedPnlToman)}
            hint={`ارزش بازار ${formatToman(dash.period.inventoryValuationToman)}`}
            icon={Warehouse}
            tone={dash.period.unrealizedPnlToman >= 0 ? "positive" : "warning"}
          />
        </div>
      ) : (
        <AdminBadge tone="warning">داده P&L در دسترس نیست</AdminBadge>
      )}

      <AdminTable
        headers={[
          "طرف",
          "وزن",
          "اسپرد",
          "کارمزد",
          "COGS",
          "P&L",
          "زمان",
        ]}
        empty={trades.length === 0}
      >
        {trades.map((t) => (
          <tr key={t.id} className="border-b border-white/5 last:border-0">
            <td className="px-4 py-3.5 md:px-5">
              <AdminBadge tone={t.side === "CUSTOMER_BUY" ? "gold" : "neutral"}>
                {t.side}
              </AdminBadge>
            </td>
            <td className="px-4 py-3.5 tabular-nums md:px-5">
              {(Number(t.weight_mg) / 1000).toLocaleString("fa-IR", {
                maximumFractionDigits: 3,
              })}{" "}
              گرم
            </td>
            <td className="px-4 py-3.5 tabular-nums md:px-5">
              {formatToman(Number(t.spread_revenue_toman))}
            </td>
            <td className="px-4 py-3.5 tabular-nums md:px-5">
              {formatToman(Number(t.fee_revenue_toman))}
            </td>
            <td className="px-4 py-3.5 tabular-nums md:px-5">
              {formatToman(Number(t.inventory_cost_toman))}
            </td>
            <td className="px-4 py-3.5 tabular-nums md:px-5">
              {formatToman(Number(t.realized_pnl_toman))}
            </td>
            <td className="px-4 py-3.5 text-white/45 md:px-5">
              {new Date(t.created_at).toLocaleString("fa-IR")}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
