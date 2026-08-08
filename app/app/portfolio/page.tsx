"use client";

import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { PriceChart } from "@/components/ui/PriceChart";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import { unrealizedPnl } from "@/lib/app/pnl";
import { formatFaNumber, formatToman } from "@/lib/utils";
import Link from "next/link";
import { useMemo } from "react";

export default function PortfolioPage() {
  const store = useDemoStore();

  const { marketValue: valueRial, costBasis, pnl, pnlPct, avgBuyPrice } = useMemo(
    () =>
      unrealizedPnl({
        goldMg: store.goldMg,
        marketPricePerGram: store.marketPriceRial,
        avgBuyPricePerGram: store.avgBuyPriceRial,
        transactions: store.transactions,
      }),
    [
      store.goldMg,
      store.marketPriceRial,
      store.avgBuyPriceRial,
      store.transactions,
    ]
  );

  const allocation = [
    { label: "قابل فروش", mg: store.goldMg, share: 100 },
    { label: "در انتظار تخصیص", mg: 0, share: 0 },
    { label: "رزرو تحویل", mg: 0, share: 0 },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="پرتفوی"
        description="خلاصه دارایی طلا، میانگین خرید و سود/زیان نمایشی."
        action={<SimulationBadge />}
      />

      <AppCard className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(circle at 0% 0%, rgba(214,168,75,0.14), transparent 50%)",
          }}
        />
        <div className="relative grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[13px] text-muted-app">موجودی طلا</p>
            <p className="mt-2 text-[34px] font-extrabold text-text">
              <AnimatedNumber
                value={store.goldMg / 1000}
                decimals={3}
                formatter={(n) =>
                  formatFaNumber(n, {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })
                }
              />{" "}
              <span className="text-[16px] font-semibold text-muted-app">گرم</span>
            </p>
            <p className="mt-2 text-[18px] text-text-secondary">
              <AnimatedNumber value={valueRial} formatter={(n) => formatToman(Math.round(n))} />
            </p>
          </div>
          <div className="sm:text-left">
            <p className="text-[13px] text-muted-app">سود / زیان تحقق‌نیافته</p>
            <p
              className={`mt-2 text-[28px] font-extrabold ${
                pnl >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {pnl >= 0 ? "+" : ""}
              {formatToman(pnl)}
            </p>
            <p className={`mt-1 text-[13px] ${pnl >= 0 ? "text-positive" : "text-negative"}`}>
              {pnlPct >= 0 ? "+" : ""}
              {pnlPct.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪
            </p>
          </div>
        </div>
        <div className="relative mt-5 rounded-xl border border-white/[0.05] bg-[#0A0C0E]/50 p-2">
          <PriceChart variant="portfolio" height={80} range="1m" />
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link href="/app/buy">
            <GoldButton type="button">خرید</GoldButton>
          </Link>
          <Link href="/app/sell">
            <GoldButton type="button" variant="secondary">
              فروش
            </GoldButton>
          </Link>
          <Link href="/app/delivery">
            <GoldButton type="button" variant="secondary">
              تحویل فیزیکی
            </GoldButton>
          </Link>
        </div>
      </AppCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <AppCard>
          <h2 className="text-[15px] font-bold">جزئیات ارزش</h2>
          <dl className="mt-4 space-y-3 text-[13px] tabular-nums">
            <Row label="میانگین قیمت خرید" value={formatToman(avgBuyPrice)} />
            <Row label="قیمت روز" value={formatToman(store.marketPriceRial)} />
            <Row label="ارزش روز" value={formatToman(valueRial)} />
            <Row label="بهای تمام‌شده" value={formatToman(costBasis)} />
            <Row label="موجودی ریالی" value={formatToman(store.rialAvailable)} />
            <Row label="در انتظار تسویه" value={formatToman(store.rialPending)} />
          </dl>
        </AppCard>

        <AppCard>
          <h2 className="text-[15px] font-bold">ترکیب دارایی طلا</h2>
          <ul className="mt-4 space-y-3">
            {allocation.map((a) => (
              <li key={a.label}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-muted-app">{a.label}</span>
                  <span className="text-text">
                    {mgToGramsLabel(a.mg)} گرم · {a.share.toLocaleString("fa-IR")}٪
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gold-gradient"
                    style={{ width: `${a.share}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </AppCard>
      </div>

      <AppCard padded={false}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[15px] font-bold">آخرین معاملات طلا</h2>
          <Link href="/app/transactions" className="text-[13px] text-gold">
            همه
          </Link>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {store.transactions
            .filter((t) => t.type === "خرید" || t.type === "فروش" || t.type === "تحویل")
            .slice(0, 5)
            .map((tx) => (
              <li key={tx.id}>
                <Link
                  href={`/app/transactions/${tx.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02]"
                >
                  <div>
                    <p className="text-[13px] font-medium text-text">{tx.type}</p>
                    <p className="text-[12px] text-muted-app">{tx.createdAt}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] text-text">
                      {mgToGramsLabel(tx.goldMg)} گرم
                    </p>
                    <StatusBadge status={tx.status} className="mt-1" />
                  </div>
                </Link>
              </li>
            ))}
        </ul>
      </AppCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-app">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}
