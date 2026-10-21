"use client";

import { AppCard } from "@/components/app/AppCard";
import { InstrumentTabs } from "@/components/app/InstrumentTabs";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { TradeSuccessSheet } from "@/components/app/TradeSuccessSheet";
import { GoldButton } from "@/components/ui/GoldButton";
import { buyQuote } from "@/lib/commerce/fees";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import type { UiQuote } from "@/lib/core-api";
import {
  INSTRUMENTS,
  type InstrumentId,
  parseInstrumentId,
} from "@/lib/market/instruments";
import { formatToman } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const QUICK = [100_000, 1_000_000, 5_000_000];

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
  const [rial, setRial] = useState(1_000_000);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneTx, setDoneTx] = useState<string | null>(null);
  // The server quote is the only price the user can confirm; the estimate
  // above it is computed client-side and may differ.
  const [locked, setLocked] = useState<UiQuote | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const meta = INSTRUMENTS[instrument];
  const price = store.getMarketPrice(instrument);
  const quoteMeta = store.marketQuotes[instrument];

  useEffect(() => {
    const fromUrl = parseInstrumentId(searchParams.get("instrument"));
    setInstrument(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [locked]);

  const secondsLeft = locked
    ? Math.max(0, Math.ceil((new Date(locked.expiresAt).getTime() - now) / 1000))
    : 0;
  const lockedExpired = Boolean(locked) && secondsLeft === 0;

  const quote = useMemo(() => {
    return buyQuote(rial, price, store.plusActive, store.commerceSettings);
  }, [rial, price, store.plusActive, store.commerceSettings]);

  const done = store.transactions.find((t) => t.id === doneTx);

  const resetForm = () => {
    setDoneTx(null);
    setChecked(false);
    setLocked(null);
  };

  const onInstrumentChange = (id: InstrumentId) => {
    setInstrument(id);
    setChecked(false);
    setLocked(null);
    setError("");
    router.replace(`/app/buy?instrument=${id}`);
  };

  const onAmountChange = (next: number) => {
    setRial(next);
    setLocked(null);
  };

  const onRequestQuote = async () => {
    setError("");
    if (rial < meta.minBuyToman) {
      setError(`حداقل خرید ${formatToman(meta.minBuyToman)} است.`);
      return;
    }
    setLoading(true);
    const res = await store.requestQuote({ instrument, side: "BUY", toman: rial });
    setLoading(false);
    if (!res.ok || !res.quote) {
      setError(res.error ?? "دریافت قیمت ممکن نشد");
      return;
    }
    setNow(Date.now());
    setLocked(res.quote);
  };

  const onConfirm = async () => {
    setError("");
    if (!locked || lockedExpired) {
      setError("اعتبار قیمت تمام شد. قیمت جدید بگیرید.");
      return;
    }
    if (!checked) {
      setError("لطفاً تأیید بررسی مبلغ و کارمزد را علامت بزنید.");
      return;
    }
    setLoading(true);
    const res = await store.executeQuote(locked.id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "خطا در خرید");
      setLocked(null);
      return;
    }
    setDoneTx(res.txId ?? null);
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
              onChange={(e) => onAmountChange(Number(e.target.value.replace(/\D/g, "") || 0))}
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
                onClick={() => onAmountChange(rial + q)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-text-secondary hover:border-gold/40 hover:text-gold"
              >
                +{formatToman(q).replace(" تومان", "")}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onAmountChange(store.rialAvailable)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-text-secondary hover:border-gold/40 hover:text-gold"
            >
              کل موجودی کیف پول
            </button>
          </div>
        </AppCard>

        <AppCard>
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-text">برآورد قیمت</h2>
            <span className="text-[12px] text-muted-app">تخمینی — قیمت قطعی در مرحله بعد</span>
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
          {locked && (
            <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-bold text-gold">قیمت قطعی</span>
                <span className={lockedExpired ? "text-negative" : "text-warning"}>
                  {lockedExpired
                    ? "منقضی شد"
                    : `معتبر تا ${secondsLeft.toLocaleString("fa-IR")} ثانیه`}
                </span>
              </div>
              <dl className="mt-3 space-y-2 text-[13px]">
                <Row label="قیمت هر گرم" value={formatToman(locked.pricePerGram)} />
                <Row label="کارمزد" value={formatToman(locked.fee)} />
                <Row
                  label={`${meta.label} دریافتی`}
                  value={`${mgToGramsLabel(locked.goldMg)} گرم`}
                  highlight
                />
                <Row label="مبلغ کسر از کیف پول" value={formatToman(locked.gross)} highlight />
              </dl>
            </div>
          )}
          {locked && !lockedExpired && (
            <label className="mt-4 flex items-start gap-2 text-[13px] text-text-secondary">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1"
              />
              قیمت قطعی، کارمزد و مقدار نهایی {meta.label} را بررسی کردم.
            </label>
          )}
          {error && (
            <p className="mt-3 text-[13px] text-negative" role="alert">
              {error}
            </p>
          )}
          {!locked || lockedExpired ? (
            <GoldButton
              type="button"
              className="mt-5 w-full"
              disabled={loading}
              onClick={() => void onRequestQuote()}
            >
              {loading ? "در حال دریافت قیمت..." : lockedExpired ? "دریافت قیمت جدید" : "دریافت قیمت قطعی"}
            </GoldButton>
          ) : (
            <GoldButton
              type="button"
              className="mt-5 w-full"
              disabled={loading}
              onClick={() => void onConfirm()}
            >
              {loading ? "در حال ثبت..." : `تأیید و خرید ${meta.label}`}
            </GoldButton>
          )}
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
