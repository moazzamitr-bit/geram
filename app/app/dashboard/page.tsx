"use client";

import { ChartRangeTabs } from "@/components/app/ChartRangeTabs";
import { NoData } from "@/components/app/NoData";
import { DeferredPriceChart } from "@/components/ui/DeferredPriceChart";
import type { ChartRange } from "@/components/ui/PriceChart";
import { useDemoStore } from "@/lib/app/demo-store";
import { unrealizedPnl } from "@/lib/app/pnl";
import { INSTRUMENTS, type InstrumentId } from "@/lib/market/instruments";
import { tradePathForInstrument } from "@/lib/market/trade-routes";
import { cn, formatFaNumber, formatToman } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

const CARD_ORDER: InstrumentId[] = ["copper", "silver925", "gold18"];

const DOT: Record<InstrumentId, string> = {
  gold18: "#FFB800",
  silver925: "#C5CCD6",
  copper: "#C4784A",
};

const STROKE: Record<InstrumentId, string> = {
  gold18: "#E6B325",
  silver925: "#8E99A8",
  copper: "#C4784A",
};

const CARD_TITLE: Record<InstrumentId, string> = {
  gold18: "طلای ۱۸ عیار",
  silver925: "نقره",
  copper: "مس",
};

export default function DashboardPage() {
  const store = useDemoStore();
  const [range, setRange] = useState<ChartRange>("1m");
  const [chartMetal, setChartMetal] = useState<InstrumentId>("gold18");

  const rows = useMemo(() => {
    return CARD_ORDER.map((id) => {
      const pnl = unrealizedPnl({
        goldMg: store.getMetalMg(id),
        marketPricePerGram: store.getMarketPrice(id),
        avgBuyPricePerGram: store.getAvgBuyPrice(id),
        transactions: store.transactions,
        instrument: id,
      });
      return { id, ...pnl };
    });
  }, [store]);

  const metalValue = rows.reduce((sum, row) => sum + row.marketValue, 0);
  const total = metalValue + store.rialAvailable;
  const trades = store.transactions.filter((tx) => tx.type === "خرید" || tx.type === "فروش");

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-[22px] font-extrabold text-text">خانه</h1>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(28,25,23,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-text-secondary">موجودی تومانی شما</p>
            <span className="h-2.5 w-2.5 rounded-full bg-[#1F9D55]" />
          </div>
          <p className="mt-3 text-[22px] font-extrabold tabular-nums text-text">
            {formatFaNumber(store.rialAvailable)}
            <span className="mr-1 text-[13px] font-semibold text-muted-app">تومان</span>
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/app/wallet"
              className="flex h-10 items-center justify-center rounded-xl border border-black/10 text-[13px] font-bold text-text"
            >
              برداشت
            </Link>
            <Link
              href="/app/wallet"
              className="flex h-10 items-center justify-center rounded-xl bg-[#161616] text-[13px] font-bold text-white"
            >
              واریز
            </Link>
          </div>
        </article>

        {rows.map((row) => {
          const change = store.marketQuotes[row.id]?.changePercent ?? null;
          const up = (change ?? 0) >= 0;
          return (
            <article
              key={row.id}
              className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(28,25,23,0.04)]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-text">{CARD_TITLE[row.id]}</p>
                <span className="flex items-center gap-1.5">
                  {change != null && (
                    <span
                      dir="ltr"
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                        up ? "bg-[#E7F6EC] text-[#1B9E4B]" : "bg-[#FDECEC] text-[#E5484D]"
                      )}
                    >
                      {up ? "+" : ""}
                      {change.toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪
                    </span>
                  )}
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: DOT[row.id] }} />
                </span>
              </div>
              <p className="mt-3 text-[20px] font-extrabold tabular-nums text-text">
                {store.getMarketPrice(row.id) > 0 ? (
                  <>
                    {formatFaNumber(store.getMarketPrice(row.id))}
                    <span className="mr-1 text-[12px] font-semibold text-muted-app">تومان</span>
                  </>
                ) : (
                  <span className="text-muted-app">—</span>
                )}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href={tradePathForInstrument(row.id, "sell")}
                  className="flex h-10 items-center justify-center rounded-xl border border-black/10 text-[13px] font-bold text-text"
                >
                  فروش
                </Link>
                <Link
                  href={tradePathForInstrument(row.id)}
                  className="flex h-10 items-center justify-center rounded-xl bg-[#161616] text-[13px] font-bold text-white"
                >
                  خرید
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div
        dir="ltr"
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,340px)]"
      >
        <section
          dir="rtl"
          className="order-1 rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(28,25,23,0.04)] md:p-5 lg:order-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold text-text">دارایی‌های من</h2>
              <p className="mt-1 text-[12px] text-muted-app">مجموع دارایی‌ها</p>
            </div>
            <p className="text-[13px] font-bold tabular-nums text-text">{formatToman(total)}</p>
          </div>
          <AllocationBar
            parts={[
              { color: "#1F9D55", value: store.rialAvailable },
              ...rows.map((row) => ({ color: DOT[row.id], value: row.marketValue })),
            ]}
          />
          <ul className="mt-4 space-y-3">
            {rows.map((row) => {
              const pct = total > 0 ? (row.marketValue / total) * 100 : 0;
              return (
                <li key={row.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-text">
                      <span className="h-2 w-2 rounded-full" style={{ background: DOT[row.id] }} />
                      {CARD_TITLE[row.id]}
                    </p>
                    <p className="mt-1 text-[12px] tabular-nums text-muted-app">
                      {formatFaNumber(row.grams, { maximumFractionDigits: 3 })} گرم
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="tabular-nums text-text">{formatToman(row.marketValue)}</p>
                    <p className="mt-1 text-[12px] tabular-nums text-muted-app">
                      {pct.toLocaleString("fa-IR", { maximumFractionDigits: 0 })}٪
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          dir="rtl"
          className="order-2 rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(28,25,23,0.04)] md:p-5 lg:order-1"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-[14px] font-bold text-text">
              <span className="sr-only">فلز نمودار</span>
              <select
                value={chartMetal}
                onChange={(event) => setChartMetal(event.target.value as InstrumentId)}
                className="bg-transparent font-bold outline-none"
              >
                {(Object.keys(INSTRUMENTS) as InstrumentId[]).map((id) => (
                  <option key={id} value={id}>
                    نمودار {CARD_TITLE[id]}
                  </option>
                ))}
              </select>
            </label>
            <ChartRangeTabs value={range} onChange={setRange} />
          </div>
          <div className="mt-3">
            <DeferredPriceChart
              variant="market"
              appearance="light"
              showAxis
              stroke={STROKE[chartMetal]}
              instrument={chartMetal}
              range={range}
              height={260}
            />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-white shadow-[0_10px_30px_rgba(28,25,23,0.04)]">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
          <h2 className="text-[15px] font-bold text-text">گزارشات خرید و فروش</h2>
          {trades.length > 0 && (
            <Link href="/app/transactions" className="text-[13px] text-gold">
              همه
            </Link>
          )}
        </div>
        {trades.length === 0 ? (
          <NoData />
        ) : (
          <ul>
            {trades.slice(0, 5).map((tx) => (
              <li key={tx.id} className="border-b border-black/[0.04] last:border-0">
                <Link
                  href={`/app/transactions/${tx.id}`}
                  className="flex items-center justify-between px-5 py-3.5 text-[13px] hover:bg-black/[0.02]"
                >
                  <div>
                    <p className="font-medium text-text">{tx.type}</p>
                    <p className="text-muted-app">{tx.createdAt}</p>
                  </div>
                  <p className="tabular-nums text-text-secondary">{formatToman(tx.amountRial)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AllocationBar({ parts }: { parts: { color: string; value: number }[] }) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  return (
    <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-black/[0.05]">
      {total <= 0 ? (
        <span className="h-full w-full bg-black/[0.06]" />
      ) : (
        parts.map((part, index) =>
          part.value > 0 ? (
            <span
              key={`${part.color}-${index}`}
              style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
            />
          ) : null
        )
      )}
    </div>
  );
}
