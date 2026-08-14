import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
} from "@/components/admin/AdminUI";
import { CommerceSettingsForm } from "@/components/admin/CommerceSettingsForm";
import { hasSupabaseEnv } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/admin";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { DEFAULT_COMMERCE_SETTINGS } from "@/lib/commerce/types";

export default async function AdminSettingsPage() {
  const envOk = hasSupabaseEnv();
  let serviceOk = false;
  const projectHint = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "—";
  const settings = envOk
    ? await loadCommerceSettings().catch(() => DEFAULT_COMMERCE_SETTINGS)
    : DEFAULT_COMMERCE_SETTINGS;

  if (envOk && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createServiceClient();
      const { error } = await admin.from("profiles").select("id").limit(1);
      serviceOk = !error;
    } catch {
      serviceOk = false;
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="کارمزد و سقف"
        description="هر ذخیره با دلیل در AuditLog ثبت می‌شود (old/new/actor/timestamp)."
      />
      <AdminNotice title="محدودیت">تغییرات پرریسک باید از صف maker-checker هم عبور کنند. Edit Balance اینجا نیست.</AdminNotice>

      <div className="space-y-6">
        <CommerceSettingsForm initial={settings} />

        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5">
          <h2 className="font-bold">اتصال دیتابیس</h2>
          <dl className="mt-4 space-y-3 text-[14px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/55">متغیرهای عمومی</dt>
              <dd>
                <AdminBadge tone={envOk ? "positive" : "warning"}>
                  {envOk ? "تنظیم شده" : "ناقص"}
                </AdminBadge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/55">Service Role</dt>
              <dd>
                <AdminBadge tone={serviceOk ? "positive" : "warning"}>
                  {serviceOk ? "فعال" : "بدون دسترسی"}
                </AdminBadge>
              </dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-white/55">Project URL</dt>
              <dd
                className="break-all font-mono text-[12px] text-white/70"
                dir="ltr"
              >
                {projectHint}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[13px] text-white/45">
            Cron درآمد:{" "}
            <code className="rounded bg-white/5 px-1 text-[12px]" dir="ltr">
              GET /api/cron/revenue
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
