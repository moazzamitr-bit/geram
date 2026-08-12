"use client";

import { AppCard } from "@/components/app/AppCard";
import { InstrumentTabs } from "@/components/app/InstrumentTabs";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { TradeSuccessSheet } from "@/components/app/TradeSuccessSheet";
import { GoldButton } from "@/components/ui/GoldButton";
import { buyQuote } from "@/lib/commerce/fees";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import {
  INSTRUMENTS,
  type InstrumentId,
  parseInstrumentId,
} from "@/lib/market/instruments";
import { formatToman } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const QUICK = [500_000, 1_000_000, 5_000_000];

export default function BuyPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-6 text-muted-app">در حال بارگذاری...</div>}>
      <BuyPageInner />
    </Suspense>
  );
}

function BuyPageInner() {
  const store = useDemoStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [instrument, setInstrument] = useState<InstrumentId>(() =>
    parseInstrumentId(searchParams.get("instrument"))
  );
  const [rial, setRial] = useState(10_000_000);
  const [seconds, setSeconds] = useState(30);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneTx, setDoneTx] = useState<string | null>(null);

  const meta = INSTRUMENTS[instrument];
  const price = store.getMarketPrice(instrument);
  const quoteMeta = store.marketQuotes[instrument];

  useEffect(() => {
    const fromUrl = parseInstrumentId(searchParams.get("instrument"));
    setInstrument(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (doneTx) return;
    const t = setInterval(() => setSeconds((s) => (s <= 1 ? 30 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [doneTx]);

  const quote = useMemo(() => {
    return buyQuote(rial, price, store.plusActive, store.commerceSettings);
  }, [rial, price, store.plusActive, store.commerceSettings]);

  const done = store.transactions.find((t) => t.id === doneTx);

  const resetForm = () => {
    setDoneTx(null);
    setChecked(false);
    setSeconds(30);
  };

  const onInstrumentChange = (id: InstrumentId) => {
    setInstrument(id);
    setChecked(false);
    setError("");
    router.replace(`/app/buy?instrument=${id}`);
  };

  const onConfirm = () => {
    setError("");
    if (!checked) {
      setError("لطفاً تأیید بررسی مبلغ و کارمزد را علامت بزنید.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const res = store.buyMetal(instrument, rial);
      setLoading(false);
      if (!res.ok) {
        setError(res.error ?? "خطا در خرید");
        return;
      }
      setDoneTx(res.txId ?? null);
    }, 700);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <TradeSuccessSheet
        open={Boolean(doneTx && done)}
        title="خرید انجام شد"
        subtitle={`${meta.label} پس از کسر کارمزد به دارایی شما اضافه شد.`}
        goldLabel={done ? `${mgToGramsLabel(done.goldMg)} گرم` : undefined}
        amountLabel={done ? formatToman(done.amountRial) : undefined}
        feeLabel={done ? formatToman(done.feeRial) : undefined}
        trackingCode={done?.trackingCode}
        statusLabel={done?.status}
        receiptHref={`/app/transactions/${doneTx}`}
        secondaryLabel="خرید دوباره"
        onSecondary={resetForm}
        onClose={resetForm}
      />

      <PageHeader
        title={`خرید ${meta.label}`}
        description="طلا، نقره و مس — قیمت و کارمزد شفاف قبل از تأیید."
        action={<SimulationBadge />}
      />

      <div className="space-y-5">
        <AppCard>
          <InstrumentTabs value={instrument} onChange={onInstrumentChange} />
          <div className="mt-5 flex items-center justify-between text-[13px]">
            <span className="text-muted-app">وضعیت بازار</span>
            <span className="text-positive">
              {store.marketStatus === "open" ? "باز است" : "بسته"}
            </span>
          </div>
          <p className="mt-2 text-[13px] text-text-secondary">
            {meta.title} ·{" "}
            <span className="tabular-nums text-text">{formatToman(price)}</span>{" "}
            / گرم
          </p>
          <label className="mt-5 block">
            <span className="text-[13px] text-text-secondary">مبلغ خرید (تومان)</span>
            <input
              dir="ltr"
              inputMode="numeric"
              value={rial}
              onChange={(e) => setRial(Number(e.target.value.replace(/\D/g, "") || 0))}
              className="mt-2 h-14 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left text-[24px] font-bold tabular-nums text-text outline-none focus:border-gold"
            />
          </label>
          <p className="mt-2 text-[13px] tabular-nums text-muted-app">
            تقریباً {mgToGramsLabel(quote.goldMg)} گرم · حداقل خرید{" "}
            {formatToman(meta.minBuyToman)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setRial((v) => v + q)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-text-secondary hover:border-gold/40 hover:text-gold"
              >
                +{formatToman(q).replace(" تومان", "")}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRial(store.rialAvailable)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-text-secondary hover:border-gold/40 hover:text-gold"
            >
              کل موجودی کیف پول
            </button>
          </div>
        </AppCard>

        <AppCard>
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-text">جزئیات قیمت</h2>
            <span className="text-[12px] text-warning">
              این قیمت تا {seconds.toLocaleString("fa-IR")} ثانیه معتبر است.
            </span>
          </div>
          <dl className="mt-4 space-y-3 text-[13px]">
            <Row label="قیمت هر گرم" value={formatToman(price)} />
            <Row label="منبع قیمت" value={quoteMeta.source || store.marketSource} />
            <Row
              label="آخرین به‌روزرسانی"
              value={quoteMeta.updatedAt ?? store.marketUpdatedAt ?? "لحظاتی پیش"}
            />
            <Row
              label="مقدار ناخالص تقریبی"
              value={`${mgToGramsLabel(Math.floor((rial / Math.max(price, 1)) * 1000))} گرم`}
            />
            <Row
              label="کارمزد معامله"
              value={formatToman(quote.fee)}
              hint={store.plusActive ? "نرخ گرم پلاس" : "نرخ رایگان"}
            />
            <Row
              label={`${meta.label} دریافتی`}
              value={`${mgToGramsLabel(quote.goldMg)} گرم`}
              highlight
            />
            <Row label="مبلغ پرداخت" value={formatToman(rial)} highlight />
            <Row label="موجودی کیف پول" value={formatToman(store.rialAvailable)} />
          </dl>
        </AppCard>

        <AppCard>
          <h2 className="text-[15px] font-bold text-text">تأیید خرید</h2>
          <p className="mt-2 text-[13px] text-muted-app">منبع پرداخت: کیف پول گرم</p>
          <label className="mt-4 flex items-start gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1"
            />
            مبلغ، کارمزد و مقدار نهایی {meta.label} را بررسی کردم.
          </label>
          {error && (
            <p className="mt-3 text-[13px] text-negative" role="alert">
              {error}
            </p>
          )}
          <GoldButton
            type="button"
            className="mt-5 w-full"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? "در حال ثبت..." : `تأیید و خرید ${meta.label}`}
          </GoldButton>
          <button
            type="button"
            className="mt-3 w-full text-[13px] text-muted-app"
            onClick={() => router.push("/app/dashboard")}
          >
            انصراف
          </button>
        </AppCard>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  hint,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-app">
        {label}
        {hint ? (
          <span className="mr-2 text-[11px] text-gold/80">({hint})</span>
        ) : null}
      </dt>
      <dd className={highlight ? "font-bold text-gold" : "text-text"}>{value}</dd>
    </div>
  );
}
