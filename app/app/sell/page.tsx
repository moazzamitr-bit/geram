"use client";

import { AppCard } from "@/components/app/AppCard";
import { InstrumentTabs } from "@/components/app/InstrumentTabs";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { TradeSuccessSheet } from "@/components/app/TradeSuccessSheet";
import { GoldButton } from "@/components/ui/GoldButton";
import { sellQuote } from "@/lib/commerce/fees";
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

export default function SellPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-6 text-muted-app">در حال بارگذاری...</div>}>
      <SellPageInner />
    </Suspense>
  );
}

function SellPageInner() {
  const store = useDemoStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [instrument, setInstrument] = useState<InstrumentId>(() =>
    parseInstrumentId(searchParams.get("instrument"))
  );
  const [mode, setMode] = useState<"weight" | "rial">("weight");
  const [grams, setGrams] = useState(0.5);
  const [rialTarget, setRialTarget] = useState(3_000_000);
  const [dest, setDest] = useState<"wallet" | "bank">("wallet");
  const [error, setError] = useState("");
  const [doneTx, setDoneTx] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Only the server quote can be confirmed; the summary card is an estimate.
  const [locked, setLocked] = useState<UiQuote | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const meta = INSTRUMENTS[instrument];
  const price = store.getMarketPrice(instrument);
  const heldMg = store.getMetalMg(instrument);

  useEffect(() => {
    setInstrument(parseInstrumentId(searchParams.get("instrument")));
    setLocked(null);
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

  const metalMg = useMemo(() => {
    if (mode === "weight") return Math.round(grams * 1000);
    return Math.floor((rialTarget / Math.max(price, 1)) * 1000);
  }, [mode, grams, rialTarget, price]);

  const quote = useMemo(() => {
    return sellQuote(metalMg, price, store.plusActive, store.commerceSettings);
  }, [metalMg, price, store.plusActive, store.commerceSettings]);

  const done = store.transactions.find((t) => t.id === doneTx);

  const resetForm = () => {
    setDoneTx(null);
    setLocked(null);
  };

  const onInstrumentChange = (id: InstrumentId) => {
    setInstrument(id);
    setError("");
    setLocked(null);
    router.replace(`/app/sell?instrument=${id}`);
  };

  const onRequestQuote = async () => {
    setError("");
    if (dest === "bank") {
      setError("تسویه بانکی در این نسخه فعال نیست. فروش به کیف پول گرم استفاده کنید.");
      return;
    }
    if (metalMg <= 0 || metalMg > heldMg) {
      setError(`مقدار ${meta.label} قابل فروش کافی نیست.`);
      return;
    }
    setLoading(true);
    const res = await store.requestQuote({ instrument, side: "SELL", metalMg });
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
    setLoading(true);
    const res = await store.executeQuote(locked.id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "خطا");
      setLocked(null);
      return;
    }
    setDoneTx(res.txId ?? null);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <TradeSuccessSheet
        open={Boolean(doneTx && done)}
        title="فروش ثبت شد"
        subtitle={
          done?.status === "در انتظار تسویه"
            ? "تسویه به حساب بانکی انجام خواهد شد."
            : "مبلغ فروش به کیف پول گرم واریز شد."
        }
        goldLabel={done ? `${mgToGramsLabel(done.goldMg)} گرم` : undefined}
        amountLabel={done ? formatToman(done.amountRial) : undefined}
        feeLabel={done ? formatToman(done.feeRial) : undefined}
        trackingCode={done?.trackingCode}
        statusLabel={done?.status}
        receiptHref={`/app/transactions/${doneTx}`}
        secondaryLabel="فروش دوباره"
        onSecondary={resetForm}
        onClose={resetForm}
      />

      <PageHeader
        title={`فروش ${meta.label}`}
        description="طلا، نقره یا مس — مقدار، کارمزد و مقصد تسویه را قبل از تأیید ببینید."
        action={<SimulationBadge />}
      />

      <div className="space-y-5">
        <AppCard>
          <InstrumentTabs value={instrument} onChange={onInstrumentChange} />
          <div className="mt-5 flex gap-2">
            {(
              [
                ["weight", "بر اساس وزن"],
                ["rial", "بر اساس مبلغ"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={`min-h-10 rounded-full px-3 py-1.5 text-[12px] ${
                  mode === k
                    ? "bg-gold/15 text-gold"
                    : "border border-white/10 text-muted-app"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "weight" ? (
            <label className="mt-5 block">
              <span className="text-[13px] text-text-secondary">وزن (گرم)</span>
              <input
                dir="ltr"
                type="number"
                step="0.001"
                min={0}
                value={grams}
                onChange={(e) => {
                  setGrams(Number(e.target.value));
                  setLocked(null);
                }}
                className="mt-2 h-14 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left text-[24px] font-bold tabular-nums text-text outline-none focus:border-gold"
              />
            </label>
          ) : (
            <label className="mt-5 block">
              <span className="text-[13px] text-text-secondary">مبلغ تقریبی (تومان)</span>
              <input
                dir="ltr"
                inputMode="numeric"
                value={rialTarget}
                onChange={(e) => {
                  setRialTarget(Number(e.target.value.replace(/\D/g, "") || 0));
                  setLocked(null);
                }}
                className="mt-2 h-14 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left text-[24px] font-bold tabular-nums text-text outline-none focus:border-gold"
              />
            </label>
          )}
          <p className="mt-2 text-[13px] tabular-nums text-muted-app">
            {meta.label} قابل فروش: {mgToGramsLabel(heldMg)} گرم · قیمت روز{" "}
            {formatToman(price)}
          </p>
        </AppCard>

        <AppCard>
          <h2 className="text-[15px] font-bold text-text">برآورد فروش</h2>
          <p className="mt-1 text-[12px] text-muted-app">تخمینی — قیمت قطعی در مرحله بعد</p>
          <dl className="mt-4 space-y-3 text-[13px] tabular-nums">
            <div className="flex justify-between">
              <dt className="text-muted-app">وزن</dt>
              <dd>{mgToGramsLabel(metalMg)} گرم</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-app">ارزش ناخالص</dt>
              <dd>{formatToman(quote.gross)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-app">کارمزد</dt>
              <dd>{formatToman(quote.fee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-app">مبلغ تسویه</dt>
              <dd className="font-bold text-gold">{formatToman(quote.net)}</dd>
            </div>
          </dl>
        </AppCard>

        <AppCard>
          <h2 className="text-[15px] font-bold text-text">مقصد تسویه</h2>
          <div className="mt-3 flex gap-2">
            {(
              [
                ["wallet", "کیف پول گرم"],
                ["bank", "حساب بانکی"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDest(k)}
                className={`min-h-11 rounded-xl border px-4 py-3 text-[13px] ${
                  dest === k
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-white/10 text-muted-app"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted-app">
            {dest === "bank"
              ? "تسویه بانکی معمولاً تا یک روز کاری (در سندباکس: وضعیت در انتظار)."
              : "واریز آنی به موجودی قابل استفاده کیف پول."}
          </p>
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
              <dl className="mt-3 space-y-2 text-[13px] tabular-nums">
                <div className="flex justify-between">
                  <dt className="text-muted-app">قیمت هر گرم</dt>
                  <dd>{formatToman(locked.pricePerGram)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-app">وزن</dt>
                  <dd>{mgToGramsLabel(locked.goldMg)} گرم</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-app">کارمزد</dt>
                  <dd>{formatToman(locked.fee)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-app">واریز به کیف پول</dt>
                  <dd className="font-bold text-gold">{formatToman(locked.net)}</dd>
                </div>
              </dl>
            </div>
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
              {loading ? "در حال ثبت..." : `تأیید و فروش ${meta.label}`}
            </GoldButton>
          )}
        </AppCard>
      </div>
    </div>
  );
}
