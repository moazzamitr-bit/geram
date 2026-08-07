"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

const catalog = [
  { id: "p1", name: "شمش ۱ گرم", weightGrams: 1, fee: 300_000 },
  { id: "p2.5", name: "شمش ۲.۵ گرم", weightGrams: 2.5, fee: 470_000 },
  { id: "p5", name: "شمش ۵ گرم", weightGrams: 5, fee: 700_000 },
  { id: "p10", name: "شمش ۱۰ گرم", weightGrams: 10, fee: 1_110_000 },
];

function NewDeliveryInner() {
  const store = useDemoStore();
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("product") ?? "p1";
  const [productId, setProductId] = useState(initial);
  const [method, setMethod] = useState("ارسال بیمه‌شده");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const product = useMemo(
    () => catalog.find((p) => p.id === productId) ?? catalog[0],
    [productId]
  );

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="درخواست تحویل" backHref="/app/delivery" action={<SimulationBadge />} />
      <AppCard className="space-y-4">
        <label className="block text-[13px]">
          <span className="text-muted-app">محصول</span>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3"
          >
            {catalog.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px]">
          <span className="text-muted-app">روش تحویل</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3"
          >
            <option>ارسال بیمه‌شده</option>
            <option>تحویل حضوری</option>
          </select>
        </label>
        <div className="rounded-xl border border-white/[0.06] bg-[#0A0C0E] p-4 text-[13px]">
          <div className="flex justify-between">
            <span className="text-muted-app">طلای موردنیاز</span>
            <span>{product.weightGrams.toLocaleString("fa-IR")} گرم</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-muted-app">کارمزد کل</span>
            <span className="text-gold">{formatToman(product.fee)}</span>
          </div>
        </div>
        <label className="block text-[13px]">
          <span className="text-muted-app">پین تراکنش</span>
          <input
            dir="ltr"
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-center tracking-widest outline-none focus:border-gold"
          />
        </label>
        {error && <p className="text-[13px] text-negative">{error}</p>}
        <GoldButton
          type="button"
          className="w-full"
          onClick={() => {
            const res = store.requestDelivery({
              productId: product.id,
              productName: product.name,
              weightGrams: product.weightGrams,
              method,
              feeRial: product.fee,
              pin,
            });
            if (!res.ok) {
              setError(res.error ?? "خطا");
              return;
            }
            router.push(`/app/delivery/${res.id}`);
          }}
        >
          ثبت درخواست
        </GoldButton>
      </AppCard>
    </div>
  );
}

export default function NewDeliveryPage() {
  return (
    <Suspense>
      <NewDeliveryInner />
    </Suspense>
  );
}
