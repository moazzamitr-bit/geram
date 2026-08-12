"use client";

import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { AppCard } from "@/components/app/AppCard";
import { InstrumentTabs } from "@/components/app/InstrumentTabs";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { PriceChart } from "@/components/ui/PriceChart";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
import {
  INSTRUMENT_IDS,
  INSTRUMENTS,
  type InstrumentId,
} from "@/lib/market/instruments";
import { formatToman } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

const periods = [
  { label: "۱ روز", range: "1d" },
  { label: "۷ روز", range: "7d" },
  { label: "۱ ماه", range: "1m" },
  { label: "۳ ماه", range: "3m" },
  { label: "۱ سال", range: "1y" },
] as const;

export default function MarketPage() {
  const store = useDemoStore();
  const [instrument, setInstrument] = useState<InstrumentId>("gold18");
  const [period, setPeriod] =
    useState<(typeof periods)[number]["range"]>("7d");
  const price = store.getMarketPrice(instrument);
  const quote = store.marketQuotes[instrument];
  const meta = INSTRUMENTS[instrument];
  const [alertPrice, setAlertPrice] = useState(price);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [msg, setMsg] = useState("");
  const [autoBuy, setAutoBuy] = useState(false);
  const [autoBuyAmount, setAutoBuyAmount] = useState(5_000_000);
  const [smsChannel, setSmsChannel] = useState(false);

  useEffect(() => {
    setAlertPrice(price);
  }, [price, instrument]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="بازار فلزات"
        description="طلا، نقره و مس — قیمت لایو، نمودار و معامله در یک جا."
        action={<SimulationBadge />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {INSTRUMENT_IDS.map((id) => {
          const m = INSTRUMENTS[id];
          const p = store.getMarketPrice(id);
          const q = store.marketQuotes[id];
          const active = id === instrument;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setInstrument(id)}
              className={`rounded-2xl border px-4 py-3 text-right transition-colors ${
                active
                  ? "border-gold/40 bg-gold/10"
                  : "border-white/[0.07] bg-elevated-app hover:border-white/15"
              }`}
            >
              <p className="text-[12px] text-muted-app">{m.title}</p>
              <p className="mt-1 text-[18px] font-extrabold tabular-nums text-text">
                {formatToman(p)}
              </p>
              <p
                className={`mt-1 text-[12px] tabular-nums ${
                  (q.changePercent ?? 0) >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {q.changePercent != null
                  ? `${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪`
                  : "—"}
              </p>
            </button>
          );
        })}
      </div>

      <AppCard>
        <InstrumentTabs value={instrument} onChange={setInstrument} />
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] text-muted-app">{meta.title}</p>
            <p className="mt-2 text-[36px] font-extrabold text-text">
              <AnimatedNumber
                value={price}
                formatter={(n) => formatToman(Math.round(n))}
              />
            </p>
            <p className="mt-1 text-[13px] tabular-nums text-positive">
              {quote.changePercent != null
                ? `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪ تغییر`
                : "تغییر —"}
            </p>
          </div>
          <div className="space-y-1 text-[13px] tabular-nums text-muted-app">
            <p>
              بالاترین:{" "}
              {quote.highToman ? formatToman(quote.highToman) : "—"}
            </p>
            <p>
              پایین‌ترین:{" "}
              {quote.lowToman ? formatToman(quote.lowToman) : "—"}
            </p>
            <p>
              منبع:{" "}
              <span className="text-text-secondary">
                {quote.source || store.marketSource}
              </span>
            </p>
            <p>
              وضعیت:{" "}
              <span className="text-positive">
                {store.marketStatus === "open" ? "باز" : "بسته"}
              </span>
              {quote.stale ? " · ذخیره‌شده" : " · لایو ۳۰ث"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {periods.map((p) => (
            <button
              key={p.range}
              type="button"
              onClick={() => setPeriod(p.range)}
              className={`rounded-full px-3 py-1.5 text-[12px] ${
                period === p.range
                  ? "bg-gold/15 text-gold"
                  : "border border-white/10 text-muted-app"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#0A0C0E] p-3">
          <PriceChart
            variant="market"
            height={180}
            range={period}
            instrument={instrument}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/app/buy?instrument=${instrument}`}>
            <GoldButton type="button">خرید {meta.label}</GoldButton>
          </Link>
          <Link href={`/app/sell?instrument=${instrument}`}>
            <GoldButton type="button" variant="secondary">
              فروش {meta.label}
            </GoldButton>
          </Link>
        </div>
      </AppCard>

      <AppCard>
        <h2 className="text-[16px] font-bold text-text">هشدار قیمت</h2>
        <p className="mt-1 text-[12px] text-muted-app">
          فعلاً هشدار روی قیمت طلای ۱۸ عیار فعال است.
        </p>
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
            const channels = ["app", ...(smsChannel ? ["sms"] : [])];
            const res = store.addAlert({
              direction,
              priceRial: alertPrice,
              channels,
              autoBuyEnabled: autoBuy,
              autoBuyToman: autoBuy ? autoBuyAmount : 0,
            });
            if (!res.ok) {
              setMsg(res.error ?? "خطا");
              return;
            }
            setMsg("هشدار ذخیره شد.");
          }}
        >
          ثبت هشدار
        </GoldButton>
        <label className="mt-4 flex items-center gap-2 text-[13px] text-text-secondary">
          <input
            type="checkbox"
            checked={autoBuy}
            onChange={(e) => setAutoBuy(e.target.checked)}
          />
          پس از فعال شدن، خرید خودکار تا سقف مبلغ زیر
        </label>
        {autoBuy && (
          <input
            dir="ltr"
            value={autoBuyAmount}
            onChange={(e) =>
              setAutoBuyAmount(Number(e.target.value.replace(/\D/g, "") || 0))
            }
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left tabular-nums"
          />
        )}
        <label className="mt-3 flex items-center gap-2 text-[13px] text-text-secondary">
          <input
            type="checkbox"
            checked={smsChannel}
            onChange={(e) => setSmsChannel(e.target.checked)}
            disabled={!store.plusActive}
          />
          اعلان SMS {store.plusActive ? "" : "(نیاز به گرم پلاس)"}
        </label>
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
          چرا گرم برای فلزات؟
        </h2>
        <p className="mt-3 text-[14px] leading-8 text-muted-app">
          یک کیف پول برای طلا، نقره و مس؛ کارمزد شفاف قبل از تأیید؛ بدون اجرت ساخت؛
          و همان زیرساخت اعتماد، اهداف و گرم پلاس که فقط روی طلا نبود.
        </p>
      </AppCard>
    </div>
  );
}
