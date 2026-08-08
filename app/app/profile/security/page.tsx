"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="امنیت حساب"
        description="تنظیمات ورود و اعلان‌های امنیتی حساب."
        backHref="/app/profile"
        action={<SimulationBadge />}
      />

      <AppCard>
        <h2 className="text-[15px] font-bold">وضعیت امنیت</h2>
        <p className="mt-2 text-[13px] leading-7 text-muted-app">
          خرید و فروش بدون پین تراکنش انجام می‌شود تا تست جریان آسان‌تر باشد.
          لایه‌های امنیتی قوی‌تر (مثل ۲FA) در فاز بعدی اضافه می‌شوند.
        </p>
      </AppCard>

      <AppCard>
        <h2 className="text-[15px] font-bold">سایر تنظیمات امنیتی</h2>
        <ul className="mt-3 space-y-2 text-[13px] text-muted-app">
          <li className="rounded-xl border border-white/[0.06] px-3 py-3">
            ورود دو مرحله‌ای — در فاز بعدی
          </li>
          <li className="rounded-xl border border-white/[0.06] px-3 py-3">
            اعلان ورود از دستگاه جدید — فعال (نمایشی)
          </li>
        </ul>
      </AppCard>
    </div>
  );
}
