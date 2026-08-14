import {
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { listNotifications } from "@/lib/admin/queries";
import { maskPhone } from "@/lib/admin/mask";

export default async function AdminNotificationsPage() {
  const rows = await listNotifications(150);
  return (
    <div>
      <AdminPageHeader
        title="اعلان‌ها"
        description="درون‌برنامه. SMS/ایمیل تراکنشی MOCK. سیستم بازاریابی انبوه در این فاز نیست."
      />
      <div className="mb-4 flex gap-2">
        <OpsBadge state="SANDBOX" />
        <OpsBadge state="MOCK" />
      </div>
      <AdminNotice title="قالب‌ها / لاگ ارسال">
        مدیریت قالب و delivery log SMS هنوز NOT READY است. فهرست زیر اعلان درون‌برنامه است.
      </AdminNotice>
      <AdminTable headers={["کاربر", "نوع", "عنوان", "زمان"]} empty={rows.length === 0}>
        {rows.map((n) => {
          const profile = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles;
          return (
            <tr key={n.id} className="border-b border-white/5">
              <td className="px-4 py-3">{profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone) : "—"}</td>
              <td className="px-4 py-3">{n.type}</td>
              <td className="px-4 py-3">{n.title}</td>
              <td className="px-4 py-3 text-white/45">{new Date(n.created_at).toLocaleString("fa-IR")}</td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
