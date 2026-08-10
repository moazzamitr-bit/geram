import {
  AdminBadge,
  AdminPageHeader,
} from "@/components/admin/AdminUI";
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
        title="تنظیمات"
        description="وضعیت اتصال سوپابیس و متغیرهای محیطی."
      />

      <div className="space-y-4">
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
              <dd className="break-all font-mono text-[12px] text-white/70" dir="ltr">
                {projectHint}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5">
          <h2 className="font-bold">کارمزد و درآمد (پیش‌فرض DB)</h2>
          <dl className="mt-4 space-y-2 text-[13px] text-white/70">
            <div className="flex justify-between">
              <dt>خرید (رایگان / پلاس)</dt>
              <dd dir="ltr">
                {(settings.fees.buyFeePercentFree * 100).toFixed(2)}% /{" "}
                {(settings.fees.buyFeePercentPlus * 100).toFixed(2)}%
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>فروش (رایگان / پلاس)</dt>
              <dd dir="ltr">
                {(settings.fees.sellFeePercentFree * 100).toFixed(2)}% /{" "}
                {(settings.fees.sellFeePercentPlus * 100).toFixed(2)}%
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>برداشت (رایگان / پلاس)</dt>
              <dd>
                {settings.fees.withdrawFeeTomanFree.toLocaleString("fa-IR")} /{" "}
                {settings.fees.withdrawFeeTomanPlus.toLocaleString("fa-IR")} تومان
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>گرم پلاس (ماهانه)</dt>
              <dd>{settings.plus.monthlyPriceToman.toLocaleString("fa-IR")} تومان</dd>
            </div>
          </dl>
          <p className="mt-4 text-[13px] text-white/55">
            Cron DCA و هشدار:{" "}
            <code className="rounded bg-white/5 px-1 text-[12px]" dir="ltr">
              GET /api/cron/revenue
            </code>{" "}
            با{" "}
            <code className="rounded bg-white/5 px-1 text-[12px]" dir="ltr">
              CRON_SECRET
            </code>{" "}
            و Service Role.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[14px] leading-7 text-white/65">
          <p>
            برای اتصال کامل، این متغیرها را در{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-[12px]" dir="ltr">
              .env.local
            </code>{" "}
            قرار دهید:
          </p>
          <pre
            className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-4 text-[12px] text-white/80"
            dir="ltr"
          >{`NEXT_PUBLIC_SUPABASE_URL=https://ogirzyxcamuxrsenpdal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...`}</pre>
          <p className="mt-3">
            سپس migration را از{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-[12px]" dir="ltr">
              supabase/migrations
            </code>{" "}
            روی پروژه اجرا کنید و نقش یک کاربر را به{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-[12px]">admin</code>{" "}
            تغییر دهید.
          </p>
        </div>
      </div>
    </div>
  );
}
