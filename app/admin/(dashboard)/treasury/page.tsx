import {
  AdminBadge,
  AdminGuide,
  AdminPageHeader,
  AdminStatCard,
} from "@/components/admin/AdminUI";
import { adminPageGuides } from "@/lib/admin/page-guides";
import { getTreasuryDashboard } from "@/lib/db/treasury-queries";
import { formatToman } from "@/lib/utils";
import { Scale, Vault, Wallet, Percent, Coins, LineChart } from "lucide-react";

function fmtMg(mg: number) {
  return `${(mg / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم`;
}

export default async function AdminTreasuryPage() {
  const guide = adminPageGuides.treasury;
  const dash = await getTreasuryDashboard("GOLD");

  return (
    <div>
      <AdminPageHeader
        title={guide.title}
        description="موقعیت فلزی پلتفرم (GOLD) — محاسبه‌شده از رویدادها، نه موجودی دستی."
        action={
          <AdminBadge tone={dash.connected ? "positive" : "warning"}>
            {dash.connected ? "Treasury فعال" : "بدون اتصال / Service Role"}
          </AdminBadge>
        }
      />
      <AdminGuide
        purpose={guide.purpose}
        whenToUse={guide.whenToUse}
        sandboxNote={guide.sandboxNote}
      />

      {!dash.connected || !("position" in dash) ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0F1724] px-6 py-16 text-center text-[14px] text-white/50">
          برای خزانه‌داری به Supabase + SUPABASE_SERVICE_ROLE_KEY و مایگریشن treasury نیاز است.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AdminStatCard
              label="موجودی فیزیکی"
              value={fmtMg(dash.position.physicalInventoryMg)}
              hint="جمع remaining لات‌های ACTIVE"
              icon={Vault}
              tone="gold"
            />
            <AdminStatCard
              label="بدهی مشتریان"
              value={fmtMg(dash.position.customerLiabilityMg)}
              hint="مجموع gold_mg کیف‌ها"
              icon={Wallet}
            />
            <AdminStatCard
              label="موجودی آزاد"
              value={fmtMg(dash.position.availableInventoryMg)}
              hint="Physical − Liability − Reserved"
              icon={Scale}
              tone={dash.position.availableInventoryMg < 0 ? "warning" : "positive"}
            />
            <AdminStatCard
              label="نسبت پوشش"
              value={
                dash.position.coverageRatio == null
                  ? "—"
                  : dash.position.coverageRatio.toLocaleString("fa-IR", {
                      maximumFractionDigits: 3,
                    })
              }
              hint="Physical / Liability"
              icon={Percent}
              tone={
                dash.position.coverageRatio != null &&
                dash.position.coverageRatio < dash.risk.coverageTarget
                  ? "warning"
                  : "positive"
              }
            />
            <AdminStatCard
              label="میانگین بهای تمام‌شده"
              value={
                dash.position.wacTomanPerGram > 0
                  ? formatToman(Math.floor(dash.position.wacTomanPerGram))
                  : "—"
              }
              hint="WAC به ازای هر گرم"
              icon={Coins}
            />
            <AdminStatCard
              label="ارزش بازار موجودی"
              value={formatToman(dash.position.inventoryMarketValueToman)}
              hint={`P&L تحقق‌نیافته: ${formatToman(dash.position.unrealizedPnlToman)}`}
              icon={LineChart}
              tone={dash.position.unrealizedPnlToman >= 0 ? "positive" : "warning"}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5">
              <h2 className="font-bold">فرمول‌ها</h2>
              <ul className="mt-3 space-y-2 text-[13px] leading-7 text-white/55">
                <li>Customer Liability = Σ customer owned metal</li>
                <li>Available = Physical − Liability − Reserved</li>
                <li>Coverage = Physical / Liability</li>
                <li>Net metal position = Physical − Liability</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5">
              <h2 className="font-bold">پرچم‌های ریسک</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {dash.exposure.riskFlags.length === 0 ? (
                  <AdminBadge tone="positive">بدون پرچم بحرانی</AdminBadge>
                ) : (
                  dash.exposure.riskFlags.map((f) => (
                    <AdminBadge key={f} tone="warning">
                      {f}
                    </AdminBadge>
                  ))
                )}
              </div>
              <p className="mt-4 text-[13px] text-white/45">
                هدف پوشش: {dash.risk.coverageTarget} · آستانه بحرانی:{" "}
                {dash.risk.coverageCritical}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
