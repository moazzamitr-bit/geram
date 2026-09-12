import {
  AdminBadge,
  AdminGuide,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { adminPageGuides } from "@/lib/admin/page-guides";
import { listProfiles } from "@/lib/db/admin-queries";

export default async function AdminKycPage() {
  const rows = await listProfiles(200);
  const guide = adminPageGuides.kyc;

  return (
    <div>
      <AdminPageHeader
        title={guide.title}
        description="وضعیت مدارک هویت کاربران برای بررسی عملیاتی."
      />
      <AdminGuide
        purpose={guide.purpose}
        whenToUse={guide.whenToUse}
        sandboxNote={guide.sandboxNote}
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
