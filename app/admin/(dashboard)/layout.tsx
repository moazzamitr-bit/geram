import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/db/admin-queries";
import { isSupabaseConfigured } from "@/lib/db/types";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/admin";

async function haltedSwitches() {
  try {
    const { data } = await createServiceClient()
      .from("core_kill_switches")
      .select("key, reason, updated_at")
      .eq("enabled", false);
    return (data ?? []) as { key: string; reason: string | null; updated_at: string }[];
  } catch {
    return [];
  }
}

// Admin pages need cookies + service-role at request time; never prerender
// them into the Docker image (build has public Supabase URL but no secrets).
export const dynamic = "force-dynamic";

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

  const halted = await haltedSwitches();

  return (
    <AdminShell adminName={name} roleLabel={auth.profile.role === "admin" ? "SUPER_ADMIN" : auth.profile.role}>
      {halted.length ? (
        <div role="alert" className="mb-6 rounded-2xl border border-negative/40 bg-negative/10 p-4 text-[13px] leading-7 text-negative">
          <div className="font-bold">معاملات متوقف است ({halted.length} کلید خاموش)</div>
          <ul className="mt-1 space-y-0.5">
            {halted.map((h) => (
              <li key={h.key} dir="auto">
                <code>{h.key}</code> — {h.reason || "بدون دلیل"}
              </li>
            ))}
          </ul>
          <Link href="/admin/switches" className="mt-2 inline-block font-semibold underline">
            بررسی و ازسرگیری در «کلیدها»
          </Link>
        </div>
      ) : null}
      {children}
    </AdminShell>
  );
}
