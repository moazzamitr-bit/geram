import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { listAlerts } from "@/lib/admin/queries";
import { getExecutionMode, getFeatureFlags } from "@/lib/core/mode";
import { maskPhone } from "@/lib/admin/mask";

export default async function AdminAlertsPage() {
  const rows = await listAlerts();
  let flags = null;
  try {
    flags = getFeatureFlags(getExecutionMode());
  } catch {
    flags = null;
  }
  return (
    <div>
      <AdminPageHeader title="هشدار قیمت" description="Auto-buy در این فاز اجرا نمی‌شود." />
      <OpsBadge state={flags?.ALERT_AUTOBUY_ENABLED ? "SANDBOX" : "NOT_READY"} />
      <AdminNotice title="ALERT_AUTOBUY_ENABLED">
        {String(flags?.ALERT_AUTOBUY_ENABLED ?? false)}. خرید خودکار از هشدار دفترکل را تغییر نمی‌دهد.
      </AdminNotice>
      <AdminTable headers={["کاربر", "وضعیت"]} empty={rows.length === 0}>
        {rows.map((r) => {
          const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return (
            <tr key={r.id} className="border-b border-white/5">
              <td className="px-4 py-3">{profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone) : "—"}</td>
              <td className="px-4 py-3"><AdminBadge>{r.status}</AdminBadge></td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
