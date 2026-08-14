import {
  AdminBadge,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listProfiles } from "@/lib/db/admin-queries";
import { maskEmail, maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

export default async function AdminUsersPage() {
  const rows = await listProfiles(200);

  return (
    <div>
      <AdminPageHeader
        title="کاربران"
        description="برای جزئیات کامل روی نام کاربر بزنید. موجودی از این صفحه ویرایش نمی‌شود."
      />
      <AdminTable
        headers={["نام", "تماس", "نقش", "KYC", "عضویت", "360"]}
        empty={rows.length === 0}
      >
        {rows.map((u) => (
          <tr key={u.id} className="border-b border-white/5 last:border-0">
            <td className="px-4 py-3.5 md:px-5">
              <Link className="text-gold" href={`/admin/users/${u.id}`}>
                {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
              </Link>
            </td>
            <td className="px-4 py-3.5 text-white/60 md:px-5" dir="ltr">
              {maskPhone(u.phone)} · {maskEmail(u.email)}
            </td>
            <td className="px-4 py-3.5 md:px-5">
              <AdminBadge tone={u.role === "admin" ? "gold" : "neutral"}>
                {u.role === "admin" ? "SUPER_ADMIN" : u.role}
              </AdminBadge>
            </td>
            <td className="px-4 py-3.5 md:px-5">
              <AdminBadge
                tone={
                  u.kyc_status === "VERIFIED"
                    ? "positive"
                    : u.kyc_status === "PENDING"
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
            <td className="px-4 py-3.5 md:px-5">
              <Link href={`/admin/users/${u.id}`} className="text-[12px] text-gold">
                مشاهده
              </Link>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
