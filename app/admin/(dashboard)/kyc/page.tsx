import {
  AdminBadge,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listProfiles } from "@/lib/db/admin-queries";

export default async function AdminKycPage() {
  const rows = await listProfiles(200);

  return (
    <div>
      <AdminPageHeader
        title="احراز هویت"
        description="وضعیت KYC کاربران برای تأیید دستی."
      />
      <AdminTable
        headers={["کاربر", "تماس", "وضعیت", "تاریخ"]}
        empty={rows.length === 0}
      >
        {rows.map((u) => (
          <tr key={u.id} className="border-b border-white/5 last:border-0">
            <td className="px-4 py-3.5 md:px-5">
              {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
            </td>
            <td className="px-4 py-3.5 text-white/60 md:px-5" dir="ltr">
              {u.phone || u.email || "—"}
            </td>
            <td className="px-4 py-3.5 md:px-5">
              <AdminBadge
                tone={
                  u.kyc_status === "VERIFIED"
                    ? "positive"
                    : u.kyc_status === "PENDING" || u.kyc_status === "NEEDS_UPDATE"
                      ? "warning"
                      : u.kyc_status === "REJECTED"
                        ? "negative"
                        : "neutral"
                }
              >
                {u.kyc_status}
              </AdminBadge>
            </td>
            <td className="px-4 py-3.5 text-white/45 md:px-5">
              {new Date(u.created_at).toLocaleDateString("fa-IR")}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
