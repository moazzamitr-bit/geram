import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { RoleAssignForm } from "@/components/admin/RoleAssignForm";
import { listProfiles } from "@/lib/db/admin-queries";
import { probeTable } from "@/lib/admin/probe";
import { ADMIN_ROLES, ROLE_PERMISSIONS } from "@/lib/admin/rbac";
import { maskEmail, maskPhone } from "@/lib/admin/mask";

export default async function AdminAdminsPage() {
  const profiles = (await listProfiles(400)).filter((p) => p.role === "admin");
  const assignments = await probeTable<{ user_id: string; admin_role: string }>(
    "admin_role_assignments",
    "*",
    { limit: 400 }
  );
  const byUser = Object.fromEntries(assignments.rows.map((r) => [r.user_id, r.admin_role]));

  return (
    <div>
      <AdminPageHeader
        title="ادمین‌ها و نقش‌ها"
        description="wallet.edit و balance.edit هرگز صادر نمی‌شوند. ورود همچنان profiles.role=admin است."
      />
      <AdminNotice title="RBAC">
        تا اعمال جدول admin_role_assignments همه ادمین‌ها SUPER_ADMIN هستند (سازگاری عقب‌رو).
      </AdminNotice>
      <AdminTable headers={["نام", "تماس", "نقش عملیاتی", "تخصیص"]} empty={profiles.length === 0}>
        {profiles.map((p) => (
          <tr key={p.id} className="border-b border-white/5 align-top">
            <td className="px-4 py-3">{[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}</td>
            <td className="px-4 py-3" dir="ltr">{maskPhone(p.phone)} · {maskEmail(p.email)}</td>
            <td className="px-4 py-3">
              <AdminBadge tone="gold">{byUser[p.id] ?? "SUPER_ADMIN"}</AdminBadge>
            </td>
            <td className="px-4 py-3 min-w-[240px]">
              <RoleAssignForm userId={p.id} />
            </td>
          </tr>
        ))}
      </AdminTable>
      <h2 className="mt-8 mb-3 font-bold">ماتریس مجوز</h2>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0F1724] p-4 text-[12px]">
        {ADMIN_ROLES.map((role) => (
          <p key={role} className="mb-2 leading-6">
            <span className="text-gold">{role}</span>: {ROLE_PERMISSIONS[role].join(" · ")}
          </p>
        ))}
        <p className="mt-3 text-negative">هرگز: wallet.edit · balance.edit</p>
      </div>
    </div>
  );
}
