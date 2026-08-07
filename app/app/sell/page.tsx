"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { TradeSuccessSheet } from "@/components/app/TradeSuccessSheet";
import { GoldButton } from "@/components/ui/GoldButton";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import { formatToman } from "@/lib/utils";
import { useMemo, useState } from "react";

export default function SellPage() {
  const store = useDemoStore();
  const [mode, setMode] = useState<"weight" | "rial">("weight");
  const [grams, setGrams] = useState(0.5);
  const [rialTarget, setRialTarget] = useState(3_000_000);
  const [dest, setDest] = useState<"wallet" | "bank">("wallet");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [doneTx, setDoneTx] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const goldMg = useMemo(() => {
    if (mode === "weight") return Math.round(grams * 1000);
    return Math.floor((rialTarget / store.marketPriceRial) * 1000);
  }, [mode, grams, rialTarget, store.marketPriceRial]);

  const quote = useMemo(() => {
    const gross = Math.floor((goldMg / 1000) * store.marketPriceRial);
    const fee = Math.max(30_000, Math.floor(gross * 0.005));
    return { gross, fee, net: Math.max(0, gross - fee) };
  }, [goldMg, store.marketPriceRial]);

  const done = store.transactions.find((t) => t.id === doneTx);

  const resetForm = () => {
    setDoneTx(null);
    setPin("");
  };

  const onConfirm = () => {
    setError("");
    setLoading(true);
    setTimeout(() => {
      const res = store.sellGold(goldMg, pin, dest);
      setLoading(false);
      if (!res.ok) {
        setError(res.error ?? "خطا");
        return;
      }
      setDoneTx(res.txId ?? null);
    }, 700);
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
        title="فروش طلا"
        description="مقدار، کارمزد و مقصد تسویه را قبل از تأیید ببینید."
        action={<SimulationBadge />}
      />

      <div className="space-y-5">
        <AppCard>
          <div className="flex gap-2">
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
                onChange={(e) => setGrams(Number(e.target.value))}
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
                onChange={(e) =>
                  setRialTarget(Number(e.target.value.replace(/\D/g, "") || 0))
                }
                className="mt-2 h-14 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left text-[24px] font-bold tabular-nums text-text outline-none focus:border-gold"
              />
            </label>
          )}
          <p className="mt-2 text-[13px] tabular-nums text-muted-app">
            طلای قابل فروش: {mgToGramsLabel(store.goldMg)} گرم
          </p>
        </AppCard>

        <AppCard>
          <h2 className="text-[15px] font-bold text-text">خلاصه فروش</h2>
          <dl className="mt-4 space-y-3 text-[13px] tabular-nums">
            <div className="flex justify-between">
              <dt className="text-muted-app">وزن</dt>
              <dd>{mgToGramsLabel(goldMg)} گرم</dd>
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
          <label className="mt-4 block">
            <span className="text-[13px] text-text-secondary">پین تراکنش</span>
            <input
              dir="ltr"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-center tracking-[0.4em] text-text outline-none focus:border-gold"
            />
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
            {loading ? "در حال ثبت..." : "تأیید و فروش"}
          </GoldButton>
        </AppCard>
      </div>
    </div>
  );
}
