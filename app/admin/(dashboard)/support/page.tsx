import {
  AdminBadge,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listTickets } from "@/lib/db/admin-queries";
import Link from "next/link";

export default async function AdminSupportPage() {
  const rows = await listTickets(100);

  return (
    <div>
      <AdminPageHeader
        title="پشتیبانی"
        description="پاسخ از جزئیات تیکت. یادداشت داخلی به کاربر نمی‌رسد."
      />
      <AdminTable
        headers={["موضوع", "دسته", "کاربر", "وضعیت", "به‌روزرسانی"]}
        empty={rows.length === 0}
      >
        {rows.map((t) => {
          const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
          return (
            <tr key={t.id} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3.5 md:px-5">
                <Link className="text-gold" href={`/admin/support/${t.id}`}>{t.subject}</Link>
              </td>
              <td className="px-4 py-3.5 md:px-5">
                <AdminBadge>{t.category}</AdminBadge>
              </td>
              <td className="px-4 py-3.5 text-white/60 md:px-5">
                {profile
                  ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                    profile.phone
                  : "—"}
              </td>
              <td className="px-4 py-3.5 md:px-5">
                <AdminBadge
                  tone={
                    t.status === "OPEN" || t.status === "WAITING_USER"
                      ? "warning"
                      : "positive"
                  }
                >
                  {t.status}
                </AdminBadge>
              </td>
              <td className="px-4 py-3.5 text-white/45 md:px-5">
                {new Date(t.updated_at).toLocaleString("fa-IR")}
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
