"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import { useState } from "react";

export default function ScheduledPurchasesPage() {
  const store = useDemoStore();
  const [amount, setAmount] = useState(5_000_000);
  const [cadence, setCadence] = useState("هر ماه، روز اول");
  const [err, setErr] = useState("");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="خرید زمان‌بندی‌شده"
        description="فقط از موجودی کیف پول — بدون برداشت خودکار بانکی."
        action={<SimulationBadge />}
      />

      <AppCard>
        <label className="block text-[13px]">
          <span className="text-muted-app">مبلغ هر نوبت</span>
          <input
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "") || 0))}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
          />
        </label>
        <label className="mt-4 block text-[13px]">
          <span className="text-muted-app">دوره</span>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3"
          >
            <option>هر ماه، روز اول</option>
            <option>هر هفته، شنبه</option>
          </select>
        </label>
        <p className="mt-3 text-[12px] text-muted-app">
          اگر موجودی کافی نباشد، خرید رد می‌شود و به شما اطلاع داده می‌شود.
          {store.plusActive
            ? ` حداکثر ${store.commerceSettings.plus.maxDcaPlus} برنامه فعال.`
            : ` پلن رایگان: ${store.commerceSettings.plus.maxDcaFree} برنامه.`}
        </p>
        {err && <p className="mt-2 text-[13px] text-negative">{err}</p>}
        <GoldButton
          type="button"
          className="mt-4 w-full"
          onClick={() => {
            const res = store.addScheduledPurchase(amount, cadence);
            if (!res.ok) {
              setErr(res.error ?? "خطا");
              return;
            }
            setErr("");
          }}
        >
          فعال‌سازی
        </GoldButton>
      </AppCard>

      {store.scheduledPurchases.length === 0 ? (
        <EmptyState
          title="برنامه فعالی ندارید"
          description="خرید دوره‌ای از کیف پول تعریف کنید تا بدون تصمیم روزانه پس‌انداز کنید."
          actionHref="/app/buy"
          actionLabel="یا همین حالا خرید کنید"
          icon={CalendarClock}
        />
      ) : (
        <AppCard>
          <ul className="space-y-3">
            {store.scheduledPurchases.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-3 text-[13px]"
              >
                <div>
                  <p className="font-medium text-text">{formatToman(s.amountRial)}</p>
                  <p className="text-muted-app">
                    {s.cadence} · بعدی: {s.nextRun}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </AppCard>
      )}
    </div>
  );
}
