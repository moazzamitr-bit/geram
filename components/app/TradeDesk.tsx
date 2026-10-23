"use client";

import { ChartRangeTabs } from "@/components/app/ChartRangeTabs";
import { NoData } from "@/components/app/NoData";
import { TradeSuccessSheet } from "@/components/app/TradeSuccessSheet";
import { PriceChart, type ChartRange } from "@/components/ui/PriceChart";
import { mgToGramsLabel, useDemoStore } from "@/lib/app/demo-store";
import {
  feeRate,
  formatGramInput,
  parseAmount,
  quotePreview,
  type AmountField,
} from "@/lib/app/trade-amount";
import type { UiQuote } from "@/lib/core-api";
import {
  INSTRUMENTS,
  type InstrumentId,
  parseInstrumentId,
} from "@/lib/market/instruments";
import { cn, formatToman } from "@/lib/utils";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STROKE: Record<InstrumentId, string> = {
  gold18: "#E6B325",
  silver925: "#8E99A8",
  copper: "#C4784A",
};

export function TradeDesk({ side }: { side: "buy" | "sell" }) {
  const store = useDemoStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [instrument, setInstrument] = useState<InstrumentId>(() =>
    parseInstrumentId(searchParams.get("instrument"))
  );
  const [edited, setEdited] = useState<AmountField>("toman");
  const [tomanText, setTomanText] = useState("0");
  const [gramText, setGramText] = useState("0");
  const [focus, setFocus] = useState<AmountField | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneTx, setDoneTx] = useState<string | null>(null);
  const [locked, setLocked] = useState<UiQuote | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [range, setRange] = useState<ChartRange>("1d");

  const meta = INSTRUMENTS[instrument];
  const price = store.getMarketPrice(instrument);
  const heldMg = store.getMetalMg(instrument);
  const plus = store.plusActive;
  const settings = store.commerceSettings;

  useEffect(() => {
    setInstrument(parseInstrumentId(searchParams.get("instrument")));
  }, [searchParams]);

  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [locked]);

  useEffect(() => {
    if (locked) return;
    const toman = parseAmount(tomanText);
    const grams = parseAmount(gramText);
    const next = quotePreview({
      side,
      edited,
      toman,
      grams,
      pricePerGram: price,
      plus,
      settings,
    });
    if (edited === "toman") {
      const formatted = formatGramInput(next.grams);
      setGramText((prev) => (prev === formatted ? prev : formatted));
    } else {
      const formatted = String(next.toman);
      setTomanText((prev) => (prev === formatted ? prev : formatted));
    }
  }, [price, locked, side, edited, plus, settings, tomanText, gramText]);

  const preview = useMemo(
    () =>
      quotePreview({
        side,
        edited,
        toman: parseAmount(tomanText),
        grams: parseAmount(gramText),
        pricePerGram: price,
        plus,
        settings,
      }),
    [side, edited, tomanText, gramText, price, plus, settings]
  );

  const secondsLeft = locked
    ? Math.max(0, Math.ceil((new Date(locked.expiresAt).getTime() - now) / 1000))
    : 0;
  const lockedExpired = Boolean(locked) && secondsLeft === 0;
  const done = store.transactions.find((tx) => tx.id === doneTx);
  const rate = feeRate(side, plus, settings);
  const rateLabel = (rate * 100).toLocaleString("fa-IR", { maximumFractionDigits: 2 });
  const history = store.transactions.filter(
    (tx) => (tx.type === "خرید" || tx.type === "فروش") && tx.instrument === instrument
  );

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
    setEdited("toman");
    setTomanText("0");
    setGramText("0");
    router.replace(`/app/${side}?instrument=${id}`);
  };

  const onTomanChange = (raw: string) => {
    setEdited("toman");
    setTomanText(raw);
    setLocked(null);
    setChecked(false);
    const next = quotePreview({
      side,
      edited: "toman",
      toman: parseAmount(raw),
      grams: 0,
      pricePerGram: price,
      plus,
      settings,
    });
    setGramText(formatGramInput(next.grams));
  };

  const onGramChange = (raw: string) => {
    setEdited("gram");
    setGramText(raw);
    setLocked(null);
    setChecked(false);
    const next = quotePreview({
      side,
      edited: "gram",
      toman: 0,
      grams: parseAmount(raw),
      pricePerGram: price,
      plus,
      settings,
    });
    setTomanText(String(next.toman));
  };

  const grouped = (value: number, digits = 0) =>
    value.toLocaleString("en-US", { maximumFractionDigits: digits });

  const onRequestQuote = async () => {
    setError("");
    if (side === "buy") {
      if (preview.toman < meta.minBuyToman) {
        setError(`حداقل خرید ${formatToman(meta.minBuyToman)} است.`);
        return;
      }
    } else if (preview.goldMg <= 0 || preview.goldMg > heldMg) {
      setError(`مقدار ${meta.label} قابل فروش کافی نیست.`);
      return;
    }
    setLoading(true);
    const res = await store.requestQuote(
      side === "buy"
        ? { instrument, side: "BUY", toman: preview.toman }
        : { instrument, side: "SELL", metalMg: preview.goldMg }
    );
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
    if (side === "buy" && !checked) {
      setError("لطفاً تأیید بررسی مبلغ و کارمزد را علامت بزنید.");
      return;
    }
    setLoading(true);
    const res = await store.executeQuote(locked.id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "خطا در ثبت معامله");
      setLocked(null);
      return;
    }
    setDoneTx(res.txId ?? null);
  };

  const tomanShown =
    focus === "toman" ? tomanText : grouped(parseAmount(tomanText));
  const gramShown =
    focus === "gram" ? gramText : grouped(parseAmount(gramText), 3);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <TradeSuccessSheet
        open={Boolean(doneTx && done)}
        title={side === "buy" ? "خرید انجام شد" : "فروش ثبت شد"}
        subtitle={
          side === "buy"
            ? `${meta.label} پس از کسر کارمزد به دارایی شما اضافه شد.`
            : "مبلغ فروش به کیف پول گرم واریز شد."
        }
        goldLabel={done ? `${mgToGramsLabel(done.goldMg)} گرم` : undefined}
        amountLabel={done ? formatToman(done.amountRial) : undefined}
        feeLabel={done ? formatToman(done.feeRial) : undefined}
        trackingCode={done?.trackingCode}
        statusLabel={done?.status}
        receiptHref={`/app/transactions/${doneTx}`}
        secondaryLabel={side === "buy" ? "خرید دوباره" : "فروش دوباره"}
        onSecondary={resetForm}
        onClose={resetForm}
      />

      <h1 className="text-[22px] font-extrabold text-text md:text-[26px]">
        خرید و فروش {meta.title}
      </h1>

      <div
        dir="ltr"
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]"
      >
        <section
          dir="rtl"
          className="order-1 rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(28,25,23,0.04)] md:p-5 lg:order-2"
        >
          <div className="grid grid-cols-2 rounded-xl bg-[#F3F1ED] p-1 text-[14px]">
            <SideLink
              href={`/app/buy?instrument=${instrument}`}
              active={side === "buy"}
              tone="buy"
              label={`خرید ${meta.label}`}
            />
            <SideLink
              href={`/app/sell?instrument=${instrument}`}
              active={side === "sell"}
              tone="sell"
              label={`فروش ${meta.label}`}
            />
          </div>

          <div className="mt-4 flex items-center justify-between text-[12px] text-muted-app">
            <span>قیمت هر گرم</span>
            <span className="tabular-nums text-text">{formatToman(price)}</span>
          </div>

          <label className="mt-4 block rounded-xl bg-[#F6F4F1] px-4 py-3">
            <span className="text-[12px] text-muted-app">مبلغ</span>
            <span className="mt-1 flex items-center gap-2">
              <input
                dir="ltr"
                inputMode="decimal"
                value={tomanShown}
                onFocus={() => setFocus("toman")}
                onBlur={() => setFocus(null)}
                onChange={(event) => onTomanChange(event.target.value)}
                className="w-full bg-transparent text-left text-[20px] font-bold tabular-nums text-text outline-none"
                aria-label="مبلغ به تومان"
              />
              <span className="shrink-0 text-[13px] text-muted-app">تومان</span>
            </span>
          </label>
          <p className="mt-2 text-[12px] text-muted-app">
            {side === "buy"
              ? `حداقل خرید ${formatToman(meta.minBuyToman)}`
              : `موجودی قابل فروش: ${mgToGramsLabel(heldMg)} گرم`}
          </p>

          <label className="mt-3 block rounded-xl bg-[#F6F4F1] px-4 py-3">
            <span className="text-[12px] text-muted-app">مقدار</span>
            <span className="mt-1 flex items-center gap-2">
              <input
                dir="ltr"
                inputMode="decimal"
                value={gramShown}
                onFocus={() => setFocus("gram")}
                onBlur={() => setFocus(null)}
                onChange={(event) => onGramChange(event.target.value)}
                className="w-full bg-transparent text-left text-[20px] font-bold tabular-nums text-text outline-none"
                aria-label="مقدار به گرم"
              />
              <span className="shrink-0 text-[13px] text-muted-app">گرم</span>
            </span>
          </label>

          <div className="mt-4 flex items-center justify-between text-[13px]">
            <span className="text-muted-app">کارمزد ({rateLabel}٪)</span>
            <span className="tabular-nums text-text">{formatToman(locked?.fee ?? preview.fee)}</span>
          </div>

          {locked && (
            <div className="mt-4 rounded-xl border border-black/[0.06] bg-[#FBF8F2] px-3 py-3 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-text">قیمت قطعی</span>
                <span className={lockedExpired ? "text-negative" : "text-warning"}>
                  {lockedExpired
                    ? "منقضی شد"
                    : `معتبر تا ${secondsLeft.toLocaleString("fa-IR")} ثانیه`}
                </span>
              </div>
              <p className="mt-2 tabular-nums text-text-secondary">
                {formatToman(locked.pricePerGram)} هر گرم · {mgToGramsLabel(locked.goldMg)} گرم
              </p>
            </div>
          )}

          {side === "buy" && locked && !lockedExpired && (
            <label className="mt-3 flex items-start gap-2 text-[12px] text-text-secondary">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
                className="mt-0.5"
              />
              قیمت قطعی، کارمزد و مقدار نهایی را بررسی کردم.
            </label>
          )}

          {error && (
            <p className="mt-3 text-[13px] text-negative" role="alert">
              {error}
            </p>
          )}

          {!locked || lockedExpired ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void onRequestQuote()}
              className={cn(
                "mt-4 h-12 w-full cursor-pointer rounded-xl text-[15px] font-bold text-white disabled:opacity-60",
                side === "buy" ? "bg-[#1F9D55] hover:bg-[#18864A]" : "bg-[#E5484D] hover:bg-[#D23B40]"
              )}
            >
              {loading ? "در حال دریافت قیمت..." : side === "buy" ? "تأیید خرید" : "تأیید فروش"}
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => void onConfirm()}
              className={cn(
                "mt-4 h-12 w-full cursor-pointer rounded-xl text-[15px] font-bold text-white disabled:opacity-60",
                side === "buy" ? "bg-[#1F9D55] hover:bg-[#18864A]" : "bg-[#E5484D] hover:bg-[#D23B40]"
              )}
            >
              {loading ? "در حال ثبت..." : side === "buy" ? "تأیید خرید" : "تأیید فروش"}
            </button>
          )}
        </section>

        <section
          dir="rtl"
          className="order-2 rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(28,25,23,0.04)] md:p-5 lg:order-1"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-[14px] font-bold text-text">
              <span className="sr-only">فلز نمودار</span>
              <select
                value={instrument}
                onChange={(event) => onInstrumentChange(parseInstrumentId(event.target.value))}
                className="bg-transparent font-bold outline-none"
              >
                {(Object.keys(INSTRUMENTS) as InstrumentId[]).map((id) => (
                  <option key={id} value={id}>
                    نمودار {INSTRUMENTS[id].title}
                  </option>
                ))}
              </select>
            </label>
            <ChartRangeTabs value={range} onChange={setRange} />
          </div>
          <p className="mt-3 text-[13px] tabular-nums text-muted-app">
            {price > 0 ? formatToman(price) : "—"}
          </p>
          <div className="mt-2">
            <PriceChart
              variant="market"
              appearance="light"
              showAxis
              stroke={STROKE[instrument]}
              instrument={instrument}
              range={range}
              height={280}
            />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-white shadow-[0_10px_30px_rgba(28,25,23,0.04)]">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
          <h2 className="text-[15px] font-bold text-text">گزارشات خرید و فروش</h2>
        </div>
        {history.length === 0 ? (
          <NoData />
        ) : (
          <ul>
            {history.slice(0, 8).map((tx) => (
              <li key={tx.id} className="border-b border-black/[0.04] last:border-0">
                <Link
                  href={`/app/transactions/${tx.id}`}
                  className="flex items-center justify-between px-5 py-3.5 text-[13px] hover:bg-black/[0.02]"
                >
                  <div>
                    <p className="font-medium text-text">
                      {tx.type} {meta.label}
                    </p>
                    <p className="text-muted-app">{tx.createdAt}</p>
                  </div>
                  <div className="text-left tabular-nums">
                    <p className="text-text">{mgToGramsLabel(tx.goldMg)} گرم</p>
                    <p className="text-muted-app">{formatToman(tx.amountRial)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SideLink({
  href,
  active,
  tone,
  label,
}: {
  href: string;
  active: boolean;
  tone: "buy" | "sell";
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-10 items-center justify-center gap-1 rounded-lg",
        active ? "bg-white font-bold text-text shadow-sm" : "text-muted-app"
      )}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <Check size={15} strokeWidth={2.4} className={tone === "buy" ? "text-[#1F9D55]" : "text-[#E5484D]"} />
      )}
      {label}
    </Link>
  );
}
