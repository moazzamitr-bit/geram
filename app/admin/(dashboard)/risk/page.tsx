import {
  AdminBadge,
  AdminGuide,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { adminPageGuides } from "@/lib/admin/page-guides";
import { getRiskBundle, formatBuyRecommendation } from "@/lib/db/treasury-queries";
import { formatToman } from "@/lib/utils";

export default async function AdminRiskPage() {
  const guide = adminPageGuides.risk;
  const bundle = await getRiskBundle();

  return (
    <div>
      <AdminPageHeader
        title={guide.title}
        description="مواجهه فلزی، پوشش، و شبیه‌سازی شوک قیمت — بدون تغییر موجودی."
      />
      <AdminGuide purpose={guide.purpose} whenToUse={guide.whenToUse} />

      {!bundle.connected || !("assets" in bundle) ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0F1724] px-6 py-16 text-center text-[14px] text-white/50">
          داده ریسک در دسترس نیست.
        </div>
      ) : (
        <div className="space-y-8">
          {bundle.assets.map((row) => (
            <section
              key={row.asset}
              className="rounded-2xl border border-white/10 bg-[#0F1724] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[18px] font-bold">{row.asset}</h2>
                <div className="flex flex-wrap gap-2">
                  {row.exposure.riskFlags.length === 0 ? (
                    <AdminBadge tone="positive">OK</AdminBadge>
                  ) : (
                    row.exposure.riskFlags.map((f) => (
                      <AdminBadge key={f} tone="warning">
                        {f}
                      </AdminBadge>
                    ))
                  )}
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-3">
                <div>
                  <dt className="text-white/45">Physical</dt>
                  <dd className="mt-1 tabular-nums">
                    {(row.position.physicalInventoryMg / 1000).toLocaleString("fa-IR", {
                      maximumFractionDigits: 3,
                    })}{" "}
                    گرم
                  </dd>
                </div>
                <div>
                  <dt className="text-white/45">Liability</dt>
                  <dd className="mt-1 tabular-nums">
                    {(row.position.customerLiabilityMg / 1000).toLocaleString("fa-IR", {
                      maximumFractionDigits: 3,
                    })}{" "}
                    گرم
                  </dd>
                </div>
                <div>
                  <dt className="text-white/45">Coverage</dt>
                  <dd className="mt-1 tabular-nums">
                    {row.position.coverageRatio?.toLocaleString("fa-IR", {
                      maximumFractionDigits: 3,
                    }) ?? "—"}
                  </dd>
                </div>
              </dl>
              {row.previewRecommendation && (
                <p className="mt-4 rounded-xl border border-warning/20 bg-warning/5 px-3 py-2 text-[13px] text-warning">
                  پیشنهاد: {formatBuyRecommendation(row.previewRecommendation)}
                </p>
              )}
              <div className="mt-5">
                <h3 className="mb-2 text-[13px] font-bold text-white/70">
                  شبیه‌سازی شوک قیمت
                </h3>
                <AdminTable
                  headers={["شوک", "ارزش بازار", "P&L تحقق‌نیافته"]}
                  empty={row.scenarios.length === 0}
                >
                  {row.scenarios.map((s) => (
                    <tr key={s.label} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 md:px-5">{s.label}</td>
                      <td className="px-4 py-3 tabular-nums md:px-5">
                        {formatToman(s.marketValueAfterToman)}
                      </td>
                      <td className="px-4 py-3 tabular-nums md:px-5">
                        {formatToman(s.unrealizedPnlAfterToman)}
                      </td>
                    </tr>
                  ))}
                </AdminTable>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
