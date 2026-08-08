"use client";

import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { AppCard } from "@/components/app/AppCard";
import { ProgressRing } from "@/components/app/ProgressRing";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { PriceChart } from "@/components/ui/PriceChart";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import { unrealizedPnl } from "@/lib/app/pnl";
import { useAuth } from "@/lib/auth/auth-context";
import { formatFaNumber, formatToman } from "@/lib/utils";
import { ArrowUpLeft, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function DashboardPage() {
  const { user } = useAuth();
  const store = useDemoStore();
  const [hidden, setHidden] = useState(false);

  const { marketValue: valueRial, costBasis, pnl, avgBuyPrice } = useMemo(
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
  const goal = store.goals[0];
  const goalPct = goal
    ? Math.min(100, Math.round((goal.currentRial / goal.targetRial) * 100))
    : 0;
  const marketOpen = store.marketStatus === "open";
  const grams = store.goldMg / 1000;

  return (
    <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-elevated-app px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${marketOpen ? "bg-positive" : "bg-warning"}`}
          />
          <p className="text-[14px] font-medium text-text">
            {marketOpen ? "بازار باز است" : "بازار بسته / متوقف"}
          </p>
        </div>
        <p className="text-[12px] text-muted-app">
          {store.marketStale ? "آخرین قیمت ذخیره‌شده" : "قیمت لایو"} ·{" "}
          {store.marketSource}
          {store.marketUpdatedAt ? ` · ${store.marketUpdatedAt}` : ""}
        </p>
      </div>

      <AppCard className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 100% 0%, rgba(214,168,75,0.12), transparent 45%)",
          }}
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-muted-app">دارایی طلای من</p>
              <p className="mt-2 text-[36px] font-extrabold tracking-tight text-text md:text-[42px]">
                {hidden ? (
                  "••••"
                ) : (
                  <AnimatedNumber
                    value={grams}
                    decimals={3}
                    formatter={(n) =>
                      formatFaNumber(n, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })
                    }
                  />
                )}{" "}
                <span className="text-[18px] font-semibold text-muted-app">گرم</span>
              </p>
              <p className="mt-1 text-[16px] text-text-secondary">
                {hidden ? (
                  "••••••••"
                ) : (
                  <AnimatedNumber
                    value={valueRial}
                    formatter={(n) => formatToman(Math.round(n))}
                  />
                )}
              </p>
              <p
                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[12px] tabular-nums ${
                  pnl >= 0
                    ? "bg-positive/10 text-positive"
                    : "bg-negative/10 text-negative"
                }`}
              >
                {pnl >= 0 ? "+" : ""}
                {formatToman(pnl)} نسبت به میانگین خرید
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <SimulationBadge />
              {goal && (
                <ProgressRing percent={goalPct} size={64} stroke={4}>
                  <span className="text-[11px] font-bold text-gold tabular-nums">
                    {goalPct.toLocaleString("fa-IR")}٪
                  </span>
                </ProgressRing>
              )}
              <button
                type="button"
                onClick={() => setHidden((v) => !v)}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-white/[0.07] text-muted-app transition-colors hover:text-gold"
                aria-label={hidden ? "نمایش موجودی" : "مخفی کردن موجودی"}
              >
                {hidden ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.05] bg-[#0A0C0E]/50 p-2">
            <PriceChart variant="portfolio" height={72} />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/app/buy">
              <GoldButton type="button">خرید طلا</GoldButton>
            </Link>
            <Link href="/app/sell">
              <GoldButton type="button" variant="secondary">
                فروش طلا
              </GoldButton>
            </Link>
            <Link href="/app/portfolio">
              <GoldButton type="button" variant="secondary">
                پرتفوی
              </GoldButton>
            </Link>
          </div>

          {user?.kycStatus === "UNVERIFIED" && (
            <div className="mt-5 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-[13px] text-warning">
              احراز هویت شما کامل نیست. برای سقف بالاتر و برداشت،{" "}
              <Link href="/app/profile/kyc" className="underline">
                احراز هویت را شروع کنید
              </Link>
              .
            </div>
          )}

        </div>
      </AppCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <AppCard>
          <h2 className="text-[16px] font-bold text-text">خلاصه دارایی</h2>
          <dl className="mt-4 space-y-3 text-[13px] tabular-nums">
            <Row label="میانگین قیمت خرید" value={formatToman(avgBuyPrice)} />
            <Row label="ارزش روز" value={formatToman(valueRial)} />
            <Row
              label="سود/زیان"
              value={`${pnl >= 0 ? "+" : ""}${formatToman(pnl)}`}
              positive={pnl >= 0}
            />
            <Row label="بهای تمام‌شده" value={formatToman(costBasis)} />
            <Row label="طلای قابل فروش" value={`${mgToGramsLabel(store.goldMg)} گرم`} />
            <Row label="موجودی ریالی" value={formatToman(store.rialAvailable)} />
            <Row label="در انتظار تسویه" value={formatToman(store.rialPending)} />
          </dl>
        </AppCard>

        <AppCard>
          {goal ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] text-muted-app">هدف پس‌انداز</p>
                  <h2 className="mt-1 text-[16px] font-bold text-text">{goal.name}</h2>
                </div>
                <SimulationBadge />
              </div>
              <div className="mt-4 flex items-center gap-4">
                <ProgressRing percent={goalPct} size={88} stroke={6}>
                  <span className="text-[16px] font-extrabold text-gold tabular-nums">
                    {goalPct.toLocaleString("fa-IR")}٪
                  </span>
                </ProgressRing>
                <div>
                  <p className="text-[13px] tabular-nums text-muted-app">
                    {formatToman(goal.currentRial)} از {formatToman(goal.targetRial)}
                  </p>
                  <p className="mt-2 text-[12px] text-text-secondary">
                    موعد: {goal.targetDate}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gold-gradient transition-[width] duration-500 ease-out"
                  style={{ width: `${goalPct}%` }}
                />
              </div>
              <Link
                href={`/app/goals/${goal.id}`}
                className="mt-4 inline-flex items-center gap-1 text-[13px] text-gold hover:text-gold-highlight"
              >
                مشاهده هدف
                <ArrowUpLeft size={14} />
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-[16px] font-bold text-text">هدف پس‌انداز</h2>
              <p className="mt-3 text-[13px] text-muted-app">هنوز هدفی نساخته‌اید.</p>
              <Link href="/app/goals/new" className="mt-4 inline-block text-[13px] text-gold">
                ساخت هدف
              </Link>
            </>
          )}
        </AppCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AppCard>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold text-text">قیمت طلای ۱۸ عیار</h2>
              <p className="mt-2 text-[28px] font-extrabold tabular-nums text-text">
                <AnimatedNumber
                  value={store.marketPriceRial}
                  formatter={(n) => formatToman(Math.round(n))}
                />
              </p>
              <p className="mt-1 text-[13px] text-muted-app">
                هر گرم · {store.marketSource}
                {store.marketChangePercent != null && (
                  <span
                    className={
                      store.marketChangePercent >= 0
                        ? " mr-2 text-positive"
                        : " mr-2 text-negative"
                    }
                  >
                    {store.marketChangePercent >= 0 ? "+" : ""}
                    {store.marketChangePercent.toLocaleString("fa-IR", {
                      maximumFractionDigits: 2,
                    })}
                    ٪
                  </span>
                )}
              </p>
            </div>
            <SimulationBadge />
          </div>
          <div className="mt-4 rounded-xl border border-white/[0.05] bg-[#0A0C0E]/60 p-2">
            <PriceChart variant="market" height={96} />
          </div>
          <div className="mt-5 flex gap-3">
            <Link href="/app/buy">
              <GoldButton type="button" size="sm">
                خرید
              </GoldButton>
            </Link>
            <Link href="/app/market">
              <GoldButton type="button" size="sm" variant="secondary">
                مشاهده بازار
              </GoldButton>
            </Link>
          </div>
        </AppCard>

        <AppCard>
          <div className="flex items-start justify-between">
            <h2 className="text-[16px] font-bold text-text">وضعیت پشتوانه گرم</h2>
            <SimulationBadge />
          </div>
          <dl className="mt-4 space-y-3 text-[13px]">
            <Row label="پوشش دارایی‌ها" value="۱۰۰٪" />
            <Row label="آخرین تطبیق" value="امروز، ۱۶:۳۰" />
            <Row label="وضعیت خزانه" value="عادی" />
          </dl>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-full rounded-full bg-gold-gradient" />
          </div>
          <p className="mt-2 text-[11px] text-muted-app">نسبت پوشش پشتوانه</p>
          <Link
            href="/app/trust"
            className="mt-4 inline-flex items-center gap-1 text-[13px] text-gold hover:text-gold-highlight"
          >
            مشاهده مرکز اعتماد
            <ArrowUpLeft size={14} />
          </Link>
        </AppCard>
      </div>

      <AppCard padded={false}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 md:px-6">
          <h2 className="text-[16px] font-bold text-text">تراکنش‌های اخیر</h2>
          <Link href="/app/transactions" className="text-[13px] text-gold">
            همه
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-right text-[13px] tabular-nums">
            <thead className="text-muted-app">
              <tr className="border-b border-white/[0.05]">
                <th className="px-5 py-3 font-medium md:px-6">نوع</th>
                <th className="px-3 py-3 font-medium">مقدار</th>
                <th className="px-3 py-3 font-medium">مبلغ</th>
                <th className="px-3 py-3 font-medium">وضعیت</th>
                <th className="px-5 py-3 font-medium md:px-6">تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {store.transactions.slice(0, 5).map((tx) => (
                <tr key={tx.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3.5 text-text md:px-6">
                    <Link href={`/app/transactions/${tx.id}`} className="hover:text-gold">
                      {tx.type}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-text-secondary">
                    {tx.goldMg > 0 ? `${mgToGramsLabel(tx.goldMg)} گرم` : "—"}
                  </td>
                  <td className="px-3 py-3.5 text-text-secondary">
                    {formatToman(tx.amountRial)}
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={
                        tx.status.includes("انتظار") || tx.status.includes("پردازش")
                          ? "text-warning"
                          : tx.status === "ناموفق"
                            ? "text-negative"
                            : "text-positive"
                      }
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-app md:px-6">{tx.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>
    </div>
  );
}

function Row({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-app">{label}</dt>
      <dd className={positive ? "text-positive" : "text-text"}>{value}</dd>
    </div>
  );
}
