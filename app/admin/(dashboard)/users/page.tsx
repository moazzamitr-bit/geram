import {
  AdminBadge,
  AdminGuide,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { adminPageGuides } from "@/lib/admin/page-guides";
import { listProfiles } from "@/lib/db/admin-queries";

export default async function AdminUsersPage() {
  const rows = await listProfiles(100);
  const guide = adminPageGuides.users;

  return (
    <div>
      <AdminPageHeader
        title={guide.title}
        description="پروفایل‌های ثبت‌شده، نقش و وضعیت هویت."
      />
      <AdminGuide
        purpose={guide.purpose}
        whenToUse={guide.whenToUse}
        sandboxNote={guide.sandboxNote}
      />
      <AdminTable
        headers={["نام", "تلفن/ایمیل", "نقش", "KYC", "عضویت"]}
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
              <AdminBadge tone={u.role === "admin" ? "gold" : "neutral"}>
                {u.role}
              </AdminBadge>
            </td>
            <td className="px-4 py-3.5 md:px-5">
              <AdminBadge
                tone={
                  u.kyc_status === "VERIFIED"
                    ? "positive"
                    : u.kyc_status === "PENDING"
                      ? "warning"
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
