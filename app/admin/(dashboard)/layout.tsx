import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/db/admin-queries";
import { isSupabaseConfigured } from "@/lib/db/types";
import { redirect } from "next/navigation";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <AdminShell adminName="پیکربندی نشده">
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 text-[14px] leading-7 text-warning">
          متغیرهای سوپابیس تنظیم نشده‌اند. فایل{" "}
          <code className="text-gold">.env.local</code> را با URL و کلیدهای پروژه
          پر کنید، مایگریشن را اجرا کنید، سپس یک کاربر ادمین بسازید.
        </div>
        <div className="mt-6">{children}</div>
      </AdminShell>
    );
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    redirect("/admin/login");
  }

  const name =
    [auth.profile.first_name, auth.profile.last_name].filter(Boolean).join(" ") ||
    auth.profile.email ||
    "ادمین";

  return (
    <AdminShell adminName={name} roleLabel={auth.profile.role === "admin" ? "SUPER_ADMIN" : auth.profile.role}>
      {children}
    </AdminShell>
  );
}
