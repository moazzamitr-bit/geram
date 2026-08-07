"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { Package } from "lucide-react";
import Link from "next/link";

const products = [
  {
    id: "p1",
    name: "شمش ۱ گرم",
    weightGrams: 1,
    purity: "۹۹۵",
    mintFee: 180_000,
    deliveryFee: 120_000,
  },
  {
    id: "p2.5",
    name: "شمش ۲.۵ گرم",
    weightGrams: 2.5,
    purity: "۹۹۵",
    mintFee: 320_000,
    deliveryFee: 150_000,
  },
  {
    id: "p5",
    name: "شمش ۵ گرم",
    weightGrams: 5,
    purity: "۹۹۵",
    mintFee: 520_000,
    deliveryFee: 180_000,
  },
  {
    id: "p10",
    name: "شمش ۱۰ گرم",
    weightGrams: 10,
    purity: "۹۹۵",
    mintFee: 890_000,
    deliveryFee: 220_000,
  },
];

export default function DeliveryPage() {
  const store = useDemoStore();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="تحویل فیزیکی"
        description="طلای قابل تحویل خود را به شمش استاندارد تبدیل کنید."
        action={
          <div className="flex items-center gap-2">
            <SimulationBadge />
            <Link href="/app/delivery/new">
              <GoldButton type="button" size="sm">
                درخواست جدید
              </GoldButton>
            </Link>
          </div>
        }
      />

      <AppCard>
        <p className="text-[13px] text-muted-app">طلای قابل تحویل</p>
        <p className="mt-2 text-[28px] font-extrabold text-text">
          {mgToGramsLabel(store.goldMg)} گرم
        </p>
      </AppCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => (
          <AppCard key={p.id}>
            <h2 className="text-[16px] font-bold">{p.name}</h2>
            <dl className="mt-3 space-y-2 text-[13px] text-muted-app">
              <div className="flex justify-between">
                <dt>عیار</dt>
                <dd className="text-text">{p.purity}</dd>
              </div>
              <div className="flex justify-between">
                <dt>کارمزد ضرب</dt>
                <dd className="text-text">{formatToman(p.mintFee)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>هزینه ارسال</dt>
                <dd className="text-text">{formatToman(p.deliveryFee)}</dd>
              </div>
            </dl>
            <Link href={`/app/delivery/new?product=${p.id}`} className="mt-4 inline-flex">
              <GoldButton type="button" size="sm">
                انتخاب
              </GoldButton>
            </Link>
          </AppCard>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-[16px] font-bold">درخواست‌های من</h2>
        {store.deliveries.length === 0 ? (
          <EmptyState
            title="هنوز درخواست تحویلی ندارید"
            description="شمش یا سکه را انتخاب کنید و طلای دیجیتال را به‌صورت فیزیکی دریافت کنید."
            actionHref="/app/delivery/new"
            actionLabel="شروع درخواست تحویل"
            icon={Package}
          />
        ) : (
          <div className="space-y-3">
            {store.deliveries.map((d) => (
              <Link key={d.id} href={`/app/delivery/${d.id}`}>
                <AppCard className="flex items-center justify-between hover:border-gold/30">
                  <div>
                    <p className="font-medium text-text">{d.productName}</p>
                    <p className="mt-1 text-[12px] text-muted-app">
                      {d.method} · {d.createdAt}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </AppCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
