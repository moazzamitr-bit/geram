import {
  AdminBadge,
  AdminGuide,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import {
  ManualPurchaseForm,
  ProcurementActions,
  ProcurementCreateButton,
} from "@/components/admin/ProcurementActions";
import { adminPageGuides } from "@/lib/admin/page-guides";
import {
  formatBuyRecommendation,
  listReplenishments,
} from "@/lib/db/treasury-queries";
import { formatToman } from "@/lib/utils";

export default async function AdminProcurementPage() {
  const guide = adminPageGuides.procurement;
  const rows = await listReplenishments(50);

  return (
    <div>
      <AdminPageHeader
        title={guide.title}
        description="پیشنهاد replenishment هرگز خودکار خرید نمی‌کند — تأیید و اجرا جداست."
        action={<ProcurementCreateButton />}
      />
      <AdminGuide
        purpose={guide.purpose}
        whenToUse={guide.whenToUse}
        sandboxNote={guide.sandboxNote}
      />

      <div className="mb-6">
        <ManualPurchaseForm />
      </div>

      <AdminTable
        headers={[
          "پیشنهاد",
          "دلیل",
          "پوشش قبل",
          "برآورد هزینه",
          "وضعیت",
          "اقدام",
        ]}
        empty={rows.length === 0}
      >
        {rows.map((r) => {
          const label = formatBuyRecommendation({
            asset: r.asset,
            recommendedWeightMg: Number(r.recommended_weight_mg),
            reason: r.reason,
            coverageBefore: r.coverage_before,
            coverageTarget: Number(r.coverage_target ?? 1.15),
          });
          return (
            <tr key={r.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3.5 font-bold text-gold md:px-5">{label}</td>
              <td className="max-w-[280px] px-4 py-3.5 text-[12px] text-white/55 md:px-5">
                {r.reason}
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {r.coverage_before != null
                  ? Number(r.coverage_before).toLocaleString("fa-IR", {
                      maximumFractionDigits: 3,
                    })
                  : "—"}
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {r.estimated_cost_toman != null
                  ? formatToman(Number(r.estimated_cost_toman))
                  : "—"}
              </td>
              <td className="px-4 py-3.5 md:px-5">
                <AdminBadge
                  tone={
                    r.status === "EXECUTED"
                      ? "positive"
                      : r.status === "REJECTED"
                        ? "negative"
                        : r.status === "APPROVED"
                          ? "gold"
                          : "warning"
                  }
                >
                  {r.status}
                </AdminBadge>
              </td>
              <td className="px-4 py-3.5 md:px-5">
                <ProcurementActions id={r.id} status={r.status} />
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
