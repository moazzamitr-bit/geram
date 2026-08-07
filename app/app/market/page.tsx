"use client";

import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { PriceChart } from "@/components/ui/PriceChart";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

const periods = ["۱ روز", "۷ روز", "۱ ماه", "۳ ماه", "۱ سال"] as const;

export default function MarketPage() {
  const store = useDemoStore();
  const [period, setPeriod] = useState<(typeof periods)[number]>("۷ روز");
  const [alertPrice, setAlertPrice] = useState(store.marketPriceRial);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [msg, setMsg] = useState("");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="بازار طلا"
        description="مشاهده قیمت، روند و ثبت هشدار — بدون ظاهر صرافی."
        action={<SimulationBadge />}
      />

      <AppCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] text-muted-app">طلای ۱۸ عیار</p>
            <p className="mt-2 text-[36px] font-extrabold text-text">
              <AnimatedNumber
                value={store.marketPriceRial}
                formatter={(n) => formatToman(Math.round(n))}
              />
            </p>
            <p className="mt-1 text-[13px] tabular-nums text-positive">
              {store.marketChangePercent != null
                ? `${store.marketChangePercent >= 0 ? "+" : ""}${store.marketChangePercent.toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪ تغییر`
                : "تغییر —"}
            </p>
          </div>
          <div className="space-y-1 text-[13px] tabular-nums text-muted-app">
            <p>
              بالاترین:{" "}
              {store.marketHighToman
                ? formatToman(store.marketHighToman)
                : "—"}
            </p>
            <p>
              پایین‌ترین:{" "}
              {store.marketLowToman ? formatToman(store.marketLowToman) : "—"}
            </p>
            <p>
              منبع: <span className="text-text-secondary">{store.marketSource}</span>
            </p>
            <p>
              وضعیت:{" "}
              <span className="text-positive">
                {store.marketStatus === "open" ? "باز" : "بسته"}
              </span>
              {store.marketStale ? " · ذخیره‌شده" : " · لایو ۳۰ث"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1.5 text-[12px] ${
                period === p
                  ? "bg-gold/15 text-gold"
                  : "border border-white/10 text-muted-app"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#0A0C0E] p-3">
          <PriceChart variant="market" height={180} />
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
        </div>
      </AppCard>

      <AppCard>
        <h2 className="text-[16px] font-bold text-text">هشدار قیمت</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-[13px]">
            <span className="text-muted-app">نوع</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "above" | "below")}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-text"
            >
              <option value="above">اگر بالاتر از...</option>
              <option value="below">اگر پایین‌تر از...</option>
            </select>
          </label>
          <label className="block text-[13px]">
            <span className="text-muted-app">قیمت (تومان)</span>
            <input
              dir="ltr"
              value={alertPrice}
              onChange={(e) =>
                setAlertPrice(Number(e.target.value.replace(/\D/g, "") || 0))
              }
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left tabular-nums text-text outline-none focus:border-gold"
            />
          </label>
        </div>
        <GoldButton
          type="button"
          size="sm"
          className="mt-4"
          onClick={() => {
            store.addAlert({
              direction,
              priceRial: alertPrice,
              channels: ["app"],
            });
            setMsg("هشدار ذخیره شد.");
          }}
        >
          ثبت هشدار
        </GoldButton>
        {msg && <p className="mt-2 text-[13px] text-positive">{msg}</p>}
        {store.alerts.length > 0 && (
          <ul className="mt-4 space-y-2 text-[13px]">
            {store.alerts.map((a) => (
              <li
                key={a.id}
                className="flex justify-between rounded-xl border border-white/[0.06] px-3 py-2"
              >
                <span>
                  {a.direction === "above" ? "بالاتر از" : "پایین‌تر از"}{" "}
                  {formatToman(a.priceRial)}
                </span>
                <span className="text-muted-app">{a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <AppCard>
        <h2 className="text-[16px] font-bold text-text">
          چه عواملی روی قیمت طلا تأثیر می‌گذارند؟
        </h2>
        <p className="mt-3 text-[14px] leading-8 text-muted-app">
          نرخ ارز، تقاضای فیزیکی، نرخ بهره جهانی و انتظارات تورمی از مهم‌ترین عوامل
          هستند. گرم قیمت آینده را تضمین یا پیش‌بینی قطعی نمی‌کند؛ تصمیم‌گیری با شماست.
        </p>
      </AppCard>
    </div>
  );
}
