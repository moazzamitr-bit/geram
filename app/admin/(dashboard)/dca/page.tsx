import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { listDca } from "@/lib/admin/queries";
import { getExecutionMode, getFeatureFlags } from "@/lib/core/mode";
import { maskPhone } from "@/lib/admin/mask";
import { formatToman } from "@/lib/utils";

export default async function AdminDcaPage() {
  const rows = await listDca();
  let flags = null;
  try {
    flags = getFeatureFlags(getExecutionMode());
  } catch {
    flags = null;
  }
  const enabled = flags?.DCA_ENABLED;
  return (
    <div>
      <AdminPageHeader title="خرید دوره‌ای" description="اجرای مالی واقعی DCA بعداً. جاب دمو نباید دفترکل تولید را عوض کند." />
      <OpsBadge state={!enabled ? "NOT_READY" : "SANDBOX"} />
      <AdminNotice title="وضعیت ویژگی">
        DCA_ENABLED={String(enabled ?? false)}. اگر خاموش باشد سفارش‌ها نمایش داده می‌شوند ولی execution مالی NOT READY است.
      </AdminNotice>
      <AdminTable headers={["کاربر", "مبلغ", "وضعیت"]} empty={rows.length === 0}>
        {rows.map((r) => {
          const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return (
            <tr key={r.id} className="border-b border-white/5">
              <td className="px-4 py-3">{profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone) : "—"}</td>
              <td className="px-4 py-3">{formatToman(Number(r.amount_toman ?? 0))}</td>
              <td className="px-4 py-3"><AdminBadge>{r.status}</AdminBadge></td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
