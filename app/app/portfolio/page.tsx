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
import {
  INSTRUMENT_IDS,
  INSTRUMENTS,
  instrumentLabel,
  type InstrumentId,
} from "@/lib/market/instruments";
import { formatFaNumber, formatToman } from "@/lib/utils";
import Link from "next/link";
import { useMemo } from "react";

export default function PortfolioPage() {
  const store = useDemoStore();

  const rows = useMemo(() => {
    return INSTRUMENT_IDS.map((id) => {
      const pnl = unrealizedPnl({
        goldMg: store.getMetalMg(id),
        marketPricePerGram: store.getMarketPrice(id),
        avgBuyPricePerGram: store.getAvgBuyPrice(id),
        transactions: store.transactions,
        instrument: id,
      });
      return { id, ...pnl, meta: INSTRUMENTS[id] };
    });
  }, [store]);

  const totalValue = rows.reduce((sum, r) => sum + r.marketValue, 0);
  const totalCost = rows.reduce((sum, r) => sum + r.costBasis, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="پرتفوی"
        description="طلا، نقره و مس در یک نگاه — ارزش روز و سود/زیان نمایشی."
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
            <p className="text-[13px] text-muted-app">ارزش کل فلزات</p>
            <p className="mt-2 text-[34px] font-extrabold text-text">
              <AnimatedNumber
                value={totalValue}
                formatter={(n) => formatToman(Math.round(n))}
              />
            </p>
            <p className="mt-2 text-[14px] text-text-secondary">
              موجودی ریالی: {formatToman(store.rialAvailable)}
            </p>
          </div>
          <div className="sm:text-left">
            <p className="text-[13px] text-muted-app">سود / زیان تحقق‌نیافته</p>
            <p
              className={`mt-2 text-[28px] font-extrabold ${
                totalPnl >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {totalPnl >= 0 ? "+" : ""}
              {formatToman(totalPnl)}
            </p>
            <p
              className={`mt-1 text-[13px] ${
                totalPnl >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {totalPnlPct >= 0 ? "+" : ""}
              {totalPnlPct.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪
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
          <Link href="/app/market">
            <GoldButton type="button" variant="secondary">
              بازار
            </GoldButton>
          </Link>
        </div>
      </AppCard>

      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((row) => (
          <AppCard key={row.id}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] text-muted-app">{row.meta.title}</p>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: row.meta.accent }}
              />
            </div>
            <p className="mt-2 text-[22px] font-extrabold tabular-nums text-text">
              {formatFaNumber(row.grams, {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}{" "}
              <span className="text-[13px] font-semibold text-muted-app">گرم</span>
            </p>
            <p className="mt-1 text-[14px] text-text-secondary">
              {formatToman(row.marketValue)}
            </p>
            <p
              className={`mt-2 text-[12px] tabular-nums ${
                row.pnl >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {row.pnl >= 0 ? "+" : ""}
              {formatToman(row.pnl)}
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/app/buy?instrument=${row.id}`}
                className="text-[12px] text-gold"
              >
                خرید
              </Link>
              <Link
                href={`/app/sell?instrument=${row.id}`}
                className="text-[12px] text-muted-app"
              >
                فروش
              </Link>
            </div>
          </AppCard>
        ))}
      </div>

      <AppCard>
        <h2 className="text-[15px] font-bold">جزئیات ارزش</h2>
        <dl className="mt-4 space-y-3 text-[13px] tabular-nums">
          {rows.map((row) => (
            <Row
              key={row.id}
              label={`${row.meta.label} · میانگین خرید`}
              value={formatToman(row.avgBuyPrice)}
            />
          ))}
          <Row label="ارزش کل روز" value={formatToman(totalValue)} />
          <Row label="بهای تمام‌شده" value={formatToman(totalCost)} />
          <Row label="موجودی ریالی" value={formatToman(store.rialAvailable)} />
          <Row label="در انتظار تسویه" value={formatToman(store.rialPending)} />
        </dl>
      </AppCard>

      <AppCard padded={false}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[15px] font-bold">آخرین معاملات</h2>
          <Link href="/app/transactions" className="text-[13px] text-gold">
            همه
          </Link>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {store.transactions
            .filter(
              (t) => t.type === "خرید" || t.type === "فروش" || t.type === "تحویل"
            )
            .slice(0, 8)
            .map((tx) => (
              <li key={tx.id}>
                <Link
                  href={`/app/transactions/${tx.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02]"
                >
                  <div>
                    <p className="text-[13px] font-medium text-text">
                      {tx.type} {instrumentLabel(tx.instrument as InstrumentId)}
                    </p>
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
