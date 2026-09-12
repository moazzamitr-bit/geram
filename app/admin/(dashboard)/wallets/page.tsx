import {
  AdminBadge,
  AdminGuide,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { adminPageGuides } from "@/lib/admin/page-guides";
import { listWallets } from "@/lib/db/admin-queries";
import { formatToman } from "@/lib/utils";

export default async function AdminWalletsPage() {
  const rows = await listWallets(100);
  const guide = adminPageGuides.wallets;

  return (
    <div>
      <AdminPageHeader
        title={guide.title}
        description="موجودی طلا و تومان هر کاربر در دیتابیس."
      />
      <AdminGuide
        purpose={guide.purpose}
        whenToUse={guide.whenToUse}
        sandboxNote={guide.sandboxNote}
      />
      <AdminTable
        headers={["کاربر", "KYC", "طلا (گرم)", "قابل استفاده", "در انتظار"]}
        empty={rows.length === 0}
      >
        {rows.map((w) => {
          const profile = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles;
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
