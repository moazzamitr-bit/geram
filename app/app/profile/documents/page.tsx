"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { FileText } from "lucide-react";
import Link from "next/link";

export default function DocumentsPage() {
  const store = useDemoStore();
  const docs = store.transactions.slice(0, 8);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="اسناد"
        description="رسید تراکنش‌ها و گزارش‌های قابل دانلود (نمایشی)."
        backHref="/app/profile"
        action={<SimulationBadge />}
      />

      {docs.length === 0 ? (
        <EmptyState
          title="سندی نیست"
          description="پس از خرید یا فروش، رسید تراکنش اینجا قابل مشاهده است."
          actionHref="/app/buy"
          actionLabel="خرید طلا"
          icon={FileText}
        />
      ) : (
        <div className="space-y-3">
          {docs.map((tx) => (
            <Link key={tx.id} href={`/app/transactions/${tx.id}`}>
              <AppCard className="mb-2 flex items-center justify-between hover:border-gold/30">
                <div>
                  <p className="font-medium text-text">رسید {tx.type}</p>
                  <p className="mt-1 text-[12px] text-muted-app">
                    {tx.trackingCode} · {tx.createdAt}
                  </p>
                </div>
                <div className="text-left text-[12px] text-muted-app">
                  <p>{formatToman(tx.amountRial)}</p>
                  {tx.goldMg > 0 && <p>{mgToGramsLabel(tx.goldMg)} گرم</p>}
                </div>
              </AppCard>
            </Link>
          ))}
        </div>
      )}

      <AppCard>
        <h2 className="text-[15px] font-bold">گزارش‌های دوره‌ای</h2>
        <ul className="mt-3 space-y-2 text-[13px] text-muted-app">
          <li className="rounded-xl border border-white/[0.06] px-3 py-3">
            صورت‌حساب ماهانه — به‌زودی
          </li>
          <li className="rounded-xl border border-white/[0.06] px-3 py-3">
            گزارش مالیاتی — به‌زودی
          </li>
        </ul>
      </AppCard>
    </div>
  );
}
