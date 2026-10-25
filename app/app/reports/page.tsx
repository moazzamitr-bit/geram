"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { useVerificationGate, type VerificationStep } from "@/components/app/VerificationGate";
import { AmountField } from "@/components/ui/AmountField";
import { apiJson, faDate, fieldClass, irrToTomanLabel, METAL_LABEL, ugLabel } from "@/lib/app/format";
import { cn } from "@/lib/utils";
import { Calculator, Download, FileBarChart } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  kind: "TRADE" | "CASH" | "PHYSICAL";
  at: string;
  title: string;
  asset: string | null;
  weightUg: string | null;
  amountIrr: string | null;
  feeIrr: string | null;
  feeUg: string | null;
  status: string;
  ref: string;
};
type Summary = {
  count: number;
  boughtIrr: string;
  soldIrr: string;
  depositIrr: string;
  withdrawIrr: string;
  feesIrr: string;
  netUg: Record<string, string>;
};

const KINDS = [
  { id: "ALL", label: "همه" },
  { id: "TRADE", label: "معاملات" },
  { id: "CASH", label: "واریز و برداشت تومان" },
  { id: "PHYSICAL", label: "برداشت فیزیکی" },
] as const;
const RANGES = [
  { id: "7", label: "۷ روز" },
  { id: "30", label: "۳۰ روز" },
  { id: "90", label: "۳ ماه" },
  { id: "365", label: "یک سال" },
  { id: "all", label: "همه" },
] as const;
const ASSETS = [
  { id: "", label: "همه فلزات" },
  { id: "GOLD", label: "طلا" },
  { id: "SILVER", label: "نقره" },
  { id: "COPPER", label: "مس" },
];

function isoDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
}

const signedToman = (irr: string) => {
  const v = BigInt(irr);
  return `${v > 0n ? "+" : v < 0n ? "−" : ""}${irrToTomanLabel(v < 0n ? -v : v)}`;
};
const signedUg = (ug: string) => {
  const v = BigInt(ug);
  return `${v > 0n ? "+" : v < 0n ? "−" : ""}${ugLabel(v < 0n ? -v : v)}`;
};

function Chips<T extends string>({ items, value, onChange }: { items: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => onChange(i.id)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition",
            value === i.id ? "border-[#FFB800] bg-[#FFB800]/15 font-bold text-text" : "border-black/10 bg-white text-muted-app"
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

function PriceCalculator() {
  const [asset, setAsset] = useState("GOLD");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [mode, setMode] = useState<"toman" | "grams">("toman");
  const [amount, setAmount] = useState(0);
  const [res, setRes] = useState<{ grossIrr: string; feeIrr: string; netIrr: string; weightUg: string; priceIrrPerGram: string } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!(amount > 0)) {
      setRes(null);
      setErr("");
      return;
    }
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({ asset, side, [mode]: String(amount) });
      const r = await apiJson<NonNullable<typeof res>>(`/api/reports/calc?${qs}`);
      if (r.ok) {
        setRes(r);
        setErr("");
      } else {
        setRes(null);
        setErr(r.message ?? "محاسبه انجام نشد.");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [asset, side, mode, amount]);

  return (
    <AppCard>
      <h3 className="flex items-center gap-2 text-[15px] font-bold text-text">
        <Calculator size={18} /> ماشین‌حساب قیمت
      </h3>
      <p className="mt-1 text-[12px] text-muted-app">با قیمت لحظه‌ای و کارمزد حساب شما؛ چیزی خریده یا رزرو نمی‌شود.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select className={fieldClass} value={asset} onChange={(e) => setAsset(e.target.value)}>
          <option value="GOLD">طلای ۱۸ عیار</option>
          <option value="SILVER">نقره</option>
          <option value="COPPER">مس</option>
        </select>
        <div className="grid grid-cols-2 rounded-xl bg-[#F6F4F1] p-1">
          {(["BUY", "SELL"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn("rounded-lg text-[13px]", side === s ? "bg-white font-bold shadow-sm" : "text-muted-app")}
            >
              {s === "BUY" ? "خرید" : "فروش"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <AmountField
          value={amount}
          onValueChange={setAmount}
          decimals={mode === "grams" ? 3 : 0}
          words={mode === "toman"}
          wrapperClassName="flex-1"
          className={fieldClass}
          placeholder={mode === "toman" ? "مبلغ به تومان" : "وزن به گرم"}
        />
        <button
          type="button"
          className="h-12 shrink-0 rounded-xl border border-black/10 px-3 text-[12px]"
          onClick={() => {
            setMode((m) => (m === "toman" ? "grams" : "toman"));
            setAmount(0);
          }}
        >
          {mode === "toman" ? "تومان" : "گرم"} ⇄
        </button>
      </div>
      {err && <p className="mt-2 text-[12px] text-rose-700">{err}</p>}
      {res && (
        <dl className="mt-3 space-y-2 rounded-xl bg-[#F6F4F1] p-3 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-muted-app">قیمت هر گرم ({side === "BUY" ? "خرید" : "فروش"})</dt>
            <dd>{irrToTomanLabel(res.priceIrrPerGram)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-app">وزن</dt>
            <dd>{ugLabel(res.weightUg)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-app">کارمزد</dt>
            <dd>{irrToTomanLabel(res.feeIrr)}</dd>
          </div>
          <div className="flex justify-between border-t border-black/5 pt-2 font-bold">
            <dt>{side === "BUY" ? "مبلغ قابل پرداخت" : "مبلغ دریافتی"}</dt>
            <dd>{irrToTomanLabel(side === "BUY" ? res.grossIrr : res.netIrr)}</dd>
          </div>
        </dl>
      )}
    </AppCard>
  );
}

export default function ReportsPage() {
  const gate = useVerificationGate();
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("ALL");
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("30");
  const [asset, setAsset] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (kind !== "ALL") p.set("kinds", kind);
    if (asset) p.set("asset", asset);
    if (range !== "all") p.set("from", isoDaysAgo(Number(range)));
    return p.toString();
  }, [kind, asset, range]);

  const load = useCallback(async () => {
    setErr("");
    const r = await apiJson<{ rows: Row[]; summary: Summary }>(`/api/reports?${qs}`);
    if (!r.ok) {
      if (r.error === "verification_required") gate.openGate(r.nextStep as VerificationStep);
      setRows([]);
      return setErr(r.message ?? "گزارش بارگذاری نشد.");
    }
    setRows(r.rows);
    setSummary(r.summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <PageHeader title="گزارش‌ها" description="معاملات، واریز و برداشت تومان و برداشت فیزیکی" backHref="/app/profile" />

      <AppCard className="space-y-3">
        <Chips items={KINDS} value={kind} onChange={setKind} />
        <Chips items={RANGES} value={range} onChange={setRange} />
        {kind !== "CASH" && <Chips items={ASSETS} value={asset} onChange={setAsset} />}
        <a
          href={`/api/reports?${qs}${qs ? "&" : ""}format=csv`}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#161616] text-[14px] font-bold text-white"
          onClick={(e) => {
            if (!gate.guard()) e.preventDefault();
          }}
        >
          <Download size={16} /> دریافت فایل اکسل (CSV)
        </a>
      </AppCard>

      {summary && summary.count > 0 && (
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          {[
            ["خرید", irrToTomanLabel(summary.boughtIrr)],
            ["فروش", irrToTomanLabel(summary.soldIrr)],
            ["واریز تومان", irrToTomanLabel(summary.depositIrr)],
            ["برداشت تومان", irrToTomanLabel(summary.withdrawIrr)],
            ["کارمزد پرداختی", irrToTomanLabel(summary.feesIrr)],
            ...Object.entries(summary.netUg).map(([a, ug]) => [`تغییر ${METAL_LABEL[a] ?? a}`, signedUg(ug)]),
          ].map(([k, v]) => (
            <AppCard key={k} className="p-3">
              <p className="text-[12px] text-muted-app">{k}</p>
              <p className="mt-1 font-bold text-text">{v}</p>
            </AppCard>
          ))}
        </div>
      )}

      {err && <p className="rounded-xl bg-rose-50 p-3 text-[13px] text-rose-700">{err}</p>}

      <AppCard>
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-text">
          <FileBarChart size={18} /> ریز تراکنش‌ها {summary ? `(${summary.count.toLocaleString("fa-IR")})` : ""}
        </h3>
        {rows && rows.length === 0 ? (
          <EmptyState title="در این بازه چیزی ثبت نشده" description="بازه یا نوع گزارش را تغییر دهید." />
        ) : (
          <ul className="mt-2 divide-y divide-black/5">
            {(rows ?? []).map((r, i) => (
              <li key={`${r.ref}-${i}`} className="py-3 text-[13px]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-text">{r.title}</p>
                    <p className="text-[11px] text-muted-app">
                      {faDate(r.at, true)} · <span dir="ltr">{r.ref}</span>
                    </p>
                  </div>
                  <div className="text-left">
                    {r.amountIrr && (
                      <p className={BigInt(r.amountIrr) >= 0n ? "text-emerald-700" : "text-text"}>{signedToman(r.amountIrr)}</p>
                    )}
                    {r.weightUg && <p className="text-[12px] text-muted-app">{signedUg(r.weightUg)}</p>}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-muted-app">
                  {r.status}
                  {r.feeIrr && BigInt(r.feeIrr) > 0n ? ` · کارمزد ${irrToTomanLabel(r.feeIrr)}` : ""}
                  {r.feeUg && BigInt(r.feeUg) > 0n ? ` · کارمزد ${ugLabel(r.feeUg)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <PriceCalculator />
    </div>
  );
}
