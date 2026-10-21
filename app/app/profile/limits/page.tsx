"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { formatToman } from "@/lib/utils";
import { useEffect, useState } from "react";

type LimitsResponse = {
  ok: boolean;
  limits?: { dailyBuyToman: number; dailySellToman: number; dailyWithdrawToman: number };
  used?: { buyToman: number; sellToman: number; withdrawToman: number };
  message?: string;
};

export default function LimitsPage() {
  const [data, setData] = useState<LimitsResponse | null>(null);

  useEffect(() => {
    void fetch("/api/core/limits", { cache: "no-store" })
      .then((r) => r.json() as Promise<LimitsResponse>)
      .then(setData)
      .catch(() => setData({ ok: false }));
  }, []);

  const rows =
    data?.ok && data.limits && data.used
      ? [
          { label: "خرید فلز", cap: data.limits.dailyBuyToman, used: data.used.buyToman },
          { label: "فروش فلز", cap: data.limits.dailySellToman, used: data.used.sellToman },
          {
            label: "برداشت از کیف پول",
            cap: data.limits.dailyWithdrawToman,
            used: data.used.withdrawToman,
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="سقف تراکنش‌ها"
        description="سقف روزانه هر نوع تراکنش و مقدار باقیمانده امروز (به وقت تهران)."
      />
      <AppCard>
        {!data && <p className="text-[13px] text-muted-app">در حال بارگذاری...</p>}
        {data && !data.ok && (
          <p className="text-[13px] text-negative">اطلاعات سقف‌ها در دسترس نیست.</p>
        )}
        <ul className="space-y-5">
          {rows.map((row) => {
            const pct = row.cap > 0 ? Math.min(100, Math.round((row.used / row.cap) * 100)) : 0;
            return (
              <li key={row.label}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-text">{row.label}</span>
                  <span className="tabular-nums text-muted-app">
                    {pct.toLocaleString("fa-IR")}٪
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[12px] tabular-nums text-muted-app">
                  <span>سقف: {row.cap > 0 ? formatToman(row.cap) : "بدون محدودیت"}</span>
                  <span>
                    باقیمانده:{" "}
                    {row.cap > 0 ? formatToman(Math.max(0, row.cap - row.used)) : "—"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </AppCard>
      <p className="text-[12px] text-muted-app">
        واریز به کیف پول محدودیت ندارد. سقف‌ها ممکن است بر اساس سطح احراز هویت تغییر کنند.
      </p>
    </div>
  );
}
