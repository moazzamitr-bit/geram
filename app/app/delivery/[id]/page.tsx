"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Timeline } from "@/components/app/Timeline";
import { useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { useParams } from "next/navigation";

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDemoStore();
  const d = store.deliveries.find((x) => x.id === id);

  if (!d) return <PageHeader title="درخواست یافت نشد" backHref="/app/delivery" />;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title={d.productName} backHref="/app/delivery" action={<SimulationBadge />} />
      <AppCard>
        <StatusBadge status={d.status} />
        <dl className="mt-4 space-y-3 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-muted-app">وزن</dt>
            <dd>{d.weightGrams.toLocaleString("fa-IR")} گرم</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-app">روش</dt>
            <dd>{d.method}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-app">کارمزد</dt>
            <dd>{formatToman(d.feeRial)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-app">زمان ثبت</dt>
            <dd>{d.createdAt}</dd>
          </div>
        </dl>
      </AppCard>
      <AppCard>
        <h2 className="mb-4 text-[15px] font-bold">رهگیری</h2>
        <Timeline
          items={[
            { label: "ثبت درخواست", done: true, at: d.createdAt },
            { label: "بررسی", done: d.status !== "REQUESTED" },
            { label: "آماده‌سازی", done: false },
            { label: "آماده / ارسال / تحویل", done: false },
          ]}
        />
      </AppCard>
    </div>
  );
}
