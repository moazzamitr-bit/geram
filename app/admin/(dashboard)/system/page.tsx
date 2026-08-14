import { AdminNotice, AdminPageHeader, OpsBadge } from "@/components/admin/AdminUI";
import { getExecutionMode, postgresRequired } from "@/lib/core/mode";
import { isSupabaseConfigured } from "@/lib/db/types";
import Link from "next/link";

export default function AdminSystemPage() {
  let mode: string | null = null;
  try {
    mode = getExecutionMode();
  } catch (e) {
    mode = e instanceof Error ? e.message : "unknown";
  }
  return (
    <div>
      <AdminPageHeader title="تنظیمات سیستم" description="وضعیت اجرا، دیتابیس و لینک‌های کنترل." />
      <OpsBadge state={mode === "PRODUCTION" ? "LIVE" : "SANDBOX"} />
      <AdminNotice title="اجرا">{`GERAM_EXECUTION_MODE / resolve: ${mode}`}</AdminNotice>
      <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[13px] leading-7">
        <p>Supabase پیکربندی: {isSupabaseConfigured() ? "بله" : "خیر"}</p>
        <p>Service role: {process.env.SUPABASE_SERVICE_ROLE_KEY ? "تنظیم شده" : "نیست"}</p>
        <p>Postgres URL دفترکل: {process.env.DATABASE_URL || process.env.SUPABASE_DB_URL ? "هست" : "نیست"}</p>
        <p>postgresRequired(CLOSED_BETA/PRODUCTION): {String(postgresRequired("CLOSED_BETA"))}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link className="text-gold" href="/admin/settings">کارمزد و سقف</Link>
          <Link className="text-gold" href="/admin/switches">کلیدها</Link>
          <Link className="text-gold" href="/admin/flags">فلگ‌ها</Link>
          <Link className="text-gold" href="/admin/readiness">آمادگی</Link>
        </div>
      </div>
    </div>
  );
}
