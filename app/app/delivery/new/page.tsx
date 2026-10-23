"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { GoldButton } from "@/components/ui/GoldButton";
import Link from "next/link";

export default function NewDeliveryPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="درخواست تحویل"
        description="سفارش تحویل فیزیکی در این نسخه باز نیست."
        backHref="/app/delivery"
      />
      <AppCard>
        <p className="text-[14px] leading-7 text-muted-app">
          قیمت ضرب و ارسال از قبل ساخته نشده است. وقتی این خدمت فعال شود، هزینه را قبل از ثبت می‌بینید.
        </p>
        <Link href="/app/delivery" className="mt-5 inline-flex">
          <GoldButton type="button" size="sm">
            بازگشت
          </GoldButton>
        </Link>
      </AppCard>
    </div>
  );
}
