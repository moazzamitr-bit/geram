"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import { Package } from "lucide-react";
import Link from "next/link";

export default function DeliveryPage() {
  const store = useDemoStore();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="تحویل فیزیکی"
        description="تحویل فیزیکی هنوز قیمت و سفارش فعال ندارد."
      />

      <AppCard>
        <p className="text-[13px] text-muted-app">طلای قابل تحویل</p>
        <p className="mt-2 text-[28px] font-extrabold text-text">
          {mgToGramsLabel(store.goldMg)} گرم
        </p>
      </AppCard>

      <AppCard>
        <p className="text-[14px] leading-7 text-muted-app">
          فهرست شمش، کارمزد ضرب و هزینه ارسال منتشر نشده است. تا وقتی قیمت واقعی ثبت شود، سفارشی ساخته نمی‌شود.
        </p>
      </AppCard>

      <div>
        <h2 className="mb-3 text-[16px] font-bold">درخواست‌های من</h2>
        {store.deliveries.length === 0 ? (
          <EmptyState
            title="هنوز درخواست تحویلی ندارید"
            description="وقتی تحویل فیزیکی باز شود، درخواست‌های شما اینجا دیده می‌شود."
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
