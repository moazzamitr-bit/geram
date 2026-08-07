"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { Target } from "lucide-react";
import Link from "next/link";

export default function GoalsPage() {
  const { goals } = useDemoStore();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="اهداف پس‌انداز"
        description="برای چیزی که می‌خواهید، با طلا پس‌انداز کنید."
        action={
          <div className="flex items-center gap-2">
            <SimulationBadge />
            <Link href="/app/goals/new">
              <GoldButton type="button" size="sm">
                هدف جدید
              </GoldButton>
            </Link>
          </div>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          title="هنوز هدفی نساخته‌اید"
          description="برای خودرو، ازدواج، سفر یا خانه یک هدف بسازید و قدم‌به‌قدم پیش بروید."
          actionHref="/app/goals/new"
          actionLabel="ساخت اولین هدف"
          icon={Target}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(
              100,
              Math.round((g.currentRial / g.targetRial) * 100)
            );
            return (
              <Link key={g.id} href={`/app/goals/${g.id}`}>
                <AppCard className="transition hover:border-gold/30">
                  <h2 className="text-[16px] font-bold text-text">{g.name}</h2>
                  <p className="mt-3 text-[28px] font-extrabold tabular-nums text-gold">
                    {pct.toLocaleString("fa-IR")}٪
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gold-gradient transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-3 text-[13px] tabular-nums text-muted-app">
                    {formatToman(g.currentRial)} از {formatToman(g.targetRial)}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-app">
                    هدف زمانی: {g.targetDate}
                  </p>
                </AppCard>
              </Link>
            );
          })}
        </div>
      )}

      <AppCard>
        <h2 className="text-[15px] font-bold">خریدهای زمان‌بندی‌شده</h2>
        <p className="mt-2 text-[13px] text-muted-app">
          مدیریت خریدهای دوره‌ای از موجودی کیف پول.
        </p>
        <Link href="/app/scheduled-purchases" className="mt-4 inline-flex text-[13px] text-gold">
          مشاهده و مدیریت
        </Link>
      </AppCard>
    </div>
  );
}
