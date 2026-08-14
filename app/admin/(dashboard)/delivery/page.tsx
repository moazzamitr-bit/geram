import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { listDeliveries } from "@/lib/db/admin-queries";
import { formatToman } from "@/lib/utils";
import { getExecutionMode, getFeatureFlags } from "@/lib/core/mode";

export default async function AdminDeliveryPage() {
  const rows = await listDeliveries(100);
  let enabled = false;
  try {
    enabled = getFeatureFlags(getExecutionMode()).PHYSICAL_REDEMPTION_ENABLED;
  } catch {
    enabled = false;
  }

  return (
    <div>
      <AdminPageHeader
        title="درخواست‌های تحویل"
        description="گردش fulfillment واقعی تا تأیید بعدی ساخته نمی‌شود."
      />
      <OpsBadge state={enabled ? "SANDBOX" : "NOT_READY"} />
      <AdminNotice title="PHYSICAL_REDEMPTION_ENABLED">
        {enabled ? "SANDBOX" : "NOT ENABLED / false by default. No real fulfillment workflow."}
      </AdminNotice>
      <AdminTable
        headers={["کاربر", "محصول", "وزن", "روش", "کارمزد", "وضعیت", "زمان"]}
        empty={rows.length === 0}
      >
        {rows.map((d) => {
          const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
          return (
            <tr key={d.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3.5 md:px-5">
                {profile
                  ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                    profile.phone
                  : "—"}
              </td>
              <td className="px-4 py-3.5 md:px-5">{d.product_name}</td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {Number(d.weight_grams).toLocaleString("fa-IR", {
                  maximumFractionDigits: 3,
                })}{" "}
                گرم
              </td>
              <td className="px-4 py-3.5 md:px-5">{d.method}</td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {formatToman(Number(d.fee_toman))}
              </td>
              <td className="px-4 py-3.5 md:px-5">
                <AdminBadge
                  tone={
                    d.status === "DELIVERED" || d.status === "delivered"
                      ? "positive"
                      : d.status === "CANCELLED" || d.status === "cancelled"
                        ? "negative"
                        : "warning"
                  }
                >
                  {d.status}
                </AdminBadge>
              </td>
              <td className="px-4 py-3.5 text-white/45 md:px-5">
                {new Date(d.created_at).toLocaleString("fa-IR")}
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
