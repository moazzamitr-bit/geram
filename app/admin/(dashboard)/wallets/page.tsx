import {
  AdminBadge,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listWallets } from "@/lib/db/admin-queries";
import { formatToman } from "@/lib/utils";

export default async function AdminWalletsPage() {
  const rows = await listWallets(100);

  return (
    <div>
      <AdminPageHeader
        title="کیف پول‌ها"
        description="موجودی طلا، نقره، مس و تومان هر کاربر."
      />
      <AdminTable
        headers={[
          "کاربر",
          "KYC",
          "طلا (گرم)",
          "نقره (گرم)",
          "مس (گرم)",
          "قابل استفاده",
          "در انتظار",
        ]}
        empty={rows.length === 0}
      >
        {rows.map((w) => {
          const profile = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles;
          const silver = Number((w as { silver_mg?: number }).silver_mg ?? 0);
          const copper = Number((w as { copper_mg?: number }).copper_mg ?? 0);
          return (
            <tr key={w.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3.5 md:px-5">
                {profile
                  ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                    profile.phone
                  : w.user_id.slice(0, 8)}
              </td>
              <td className="px-4 py-3.5 md:px-5">
                <AdminBadge>{profile?.kyc_status ?? "—"}</AdminBadge>
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {(Number(w.gold_mg) / 1000).toLocaleString("fa-IR", {
                  maximumFractionDigits: 3,
                })}
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {(silver / 1000).toLocaleString("fa-IR", {
                  maximumFractionDigits: 3,
                })}
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {(copper / 1000).toLocaleString("fa-IR", {
                  maximumFractionDigits: 3,
                })}
              </td>
              <td className="px-4 py-3.5 tabular-nums md:px-5">
                {formatToman(Number(w.toman_available))}
              </td>
              <td className="px-4 py-3.5 tabular-nums text-warning md:px-5">
                {formatToman(Number(w.toman_pending))}
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
