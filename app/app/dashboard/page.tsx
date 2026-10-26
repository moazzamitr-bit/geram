"use client";

import { ChartRangeTabs } from "@/components/app/ChartRangeTabs";
import { NoData } from "@/components/app/NoData";
import { DeferredPriceChart } from "@/components/ui/DeferredPriceChart";
import type { ChartRange } from "@/components/ui/PriceChart";
import { useDemoStore } from "@/lib/app/demo-store";
import { unrealizedPnl } from "@/lib/app/pnl";
import { type InstrumentId } from "@/lib/market/instruments";
import { tradePathForInstrument } from "@/lib/market/trade-routes";
import { cn, formatFaNumber, formatToman } from "@/lib/utils";
import { VerificationBanner } from "@/components/app/VerificationBanner";
import { useVerificationGate } from "@/components/app/VerificationGate";
import { ChevronLeft, CreditCard, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const CARD_ORDER: InstrumentId[] = ["gold18", "silver925", "copper"];

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
  const gate = useVerificationGate();
  const router = useRouter();
  const [range, setRange] = useState<ChartRange>("1m");

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
  const costBasis = rows.reduce((sum, row) => sum + row.costBasis, 0);
  const totalPnl = rows.reduce((sum, row) => sum + (row.marketPrice > 0 ? row.pnl : 0), 0);
  const totalPnlPct = costBasis > 0 ? (totalPnl / costBasis) * 100 : 0;
  const totalProfit = totalPnl >= 0;
  const trades = store.transactions.filter((tx) => tx.type === "خرید" || tx.type === "فروش");

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="sr-only">خانه</h1>

      <section className="rounded-3xl border border-border bg-white p-5 shadow-[0_10px_30px_rgba(28,25,23,0.05)] md:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
          <div className="text-center lg:text-right">
            <p className="text-[13px] text-text-secondary">ارزش کل دارایی‌ها</p>
            <p className="mt-2 text-[32px] font-extrabold leading-tight tabular-nums text-[#1C1917] md:text-[38px]">
              {formatFaNumber(total)}
              <span className="mr-1.5 text-[14px] font-semibold text-muted-app">تومان</span>
            </p>
            {costBasis > 0 && (
              <p
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-bold tabular-nums",
                  totalProfit ? "bg-[#E7F6EC] text-[#1B9E4B]" : "bg-[#FDECEC] text-[#E5484D]"
                )}
              >
                {totalProfit ? "سود" : "زیان"} {totalProfit ? "+" : "−"}
                {formatFaNumber(Math.abs(totalPnl))} تومان
                <span dir="ltr">
                  ({totalProfit ? "+" : "−"}
                  {Math.abs(totalPnlPct).toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪)
                </span>
              </p>
            )}
            <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-text-secondary lg:justify-start">
              <Wallet size={16} className="text-[#1F9D55]" />
              موجودی تومانی
              <span className="font-bold tabular-nums text-[#1C1917]">{formatToman(store.rialAvailable)}</span>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-[#1C1917]">قیمت طلای ۱۸ عیار</p>
              <ChartRangeTabs value={range} onChange={setRange} />
            </div>
            <DeferredPriceChart
              variant="market"
              appearance="light"
              stroke={STROKE.gold18}
              instrument="gold18"
              range={range}
              height={170}
              showExtremes
              className="mt-3"
            />
          </div>
        </div>
      </section>

      <VerificationBanner />

      <button
        type="button"
        onClick={() => gate.guard() && router.push("/app/wallet")}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-4 text-right shadow-[0_10px_30px_rgba(28,25,23,0.04)]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF4D6] text-[#8A6526]">
          <CreditCard size={22} />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-extrabold text-[#1C1917]">واریز</span>
          <span className="mt-0.5 block text-[12px] leading-6 text-text-secondary">
            موجودی تومانی خود را افزایش دهید و آماده سرمایه‌گذاری شوید
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-[#1C1917]">
          <ChevronLeft size={18} />
        </span>
      </button>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {rows.map((row) => {
          const change = store.marketQuotes[row.id]?.changePercent ?? null;
          const up = (change ?? 0) >= 0;
          const price = store.getMarketPrice(row.id);
          return (
            <Link
              key={row.id}
              href={tradePathForInstrument(row.id)}
              className={cn(
                "overflow-hidden rounded-2xl border border-border bg-white shadow-[0_10px_30px_rgba(28,25,23,0.04)]",
                row.id === "copper" && "col-span-2 lg:col-span-1"
              )}
            >
              <div className="p-4 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-[#1C1917]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: DOT[row.id] }} />
                    {CARD_TITLE[row.id]}
                  </p>
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
                </div>
                <p className="mt-2 text-[18px] font-extrabold tabular-nums text-[#1C1917]">
                  {price > 0 ? (
                    <>
                      {formatFaNumber(price)}
                      <span className="mr-1 text-[11px] font-semibold text-muted-app">تومان</span>
                    </>
                  ) : (
                    <span className="text-muted-app">—</span>
                  )}
                </p>
              </div>
              <DeferredPriceChart
                variant="market"
                appearance="light"
                stroke={STROKE[row.id]}
                instrument={row.id}
                range="7d"
                height={56}
              />
            </Link>
          );
        })}
      </div>

    <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(28,25,23,0.04)] md:p-5">
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
                  <HoldingPnl
                    grams={row.grams}
                    marketPrice={row.marketPrice}
                    avgBuyPrice={row.avgBuyPrice}
                    pnl={row.pnl}
                    pnlPct={row.pnlPct}
                  />
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
                  <p className="tabular-nums text-text-secondary">{tx.amountRial ? formatToman(tx.amountRial) : "—"}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HoldingPnl({
  grams,
  marketPrice,
  avgBuyPrice,
  pnl,
  pnlPct,
}: {
  grams: number;
  marketPrice: number;
  avgBuyPrice: number;
  pnl: number;
  pnlPct: number;
}) {
  if (grams <= 0 || marketPrice <= 0) return null;
  const profit = pnl >= 0;
  const pct = pnlPct.toLocaleString("fa-IR", { maximumFractionDigits: 1 });
  return (
    <div className="mt-2 space-y-0.5 text-[12px]">
      <p className="text-muted-app">
        میانگین خرید <span className="tabular-nums text-text">{formatToman(avgBuyPrice)}</span>
      </p>
      <p className={cn("font-semibold tabular-nums", profit ? "text-positive" : "text-negative")}>
        {profit ? "سود" : "زیان"} {profit ? "+" : ""}
        {formatToman(pnl)} ({profit ? "+" : ""}
        {pct}٪)
      </p>
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
