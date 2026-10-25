"use client";

import { GoldButton } from "@/components/ui/GoldButton";
import { AmountField } from "@/components/ui/AmountField";
import type { CommerceSettings } from "@/lib/commerce/types";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  initial: CommerceSettings;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[13px]">
      <span className="text-white/55">{label}</span>
      {hint ? <span className="mr-2 text-[11px] text-white/35">({hint})</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  step = "1",
  words = false,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: string;
  words?: boolean;
}) {
  const fraction = step.includes(".") ? (step.split(".")[1]?.length ?? 0) : 0;
  return (
    <AmountField
      value={value}
      decimals={fraction}
      words={words}
      wordsClassName="mt-1 text-[12px] text-white/45"
      onValueChange={(n) => onChange(Number.isFinite(n) ? n : 0)}
      className="h-11 w-full rounded-xl border border-white/10 bg-[#070B12] px-3 text-left tabular-nums text-white outline-none focus:border-gold"
    />
  );
}

export function CommerceSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [fees, setFees] = useState(initial.fees);
  const [plus, setPlus] = useState(initial.plus);
  const [referral, setReferral] = useState(initial.referral);
  const [limits, setLimits] = useState(initial.limits);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [reason, setReason] = useState("");

  const preview = useMemo(() => {
    const sampleBuy = 10_000_000;
    const freeFee = Math.max(
      fees.buyFeeMinTomanFree,
      Math.floor(sampleBuy * fees.buyFeePercentFree)
    );
    const plusFee = Math.max(
      fees.buyFeeMinTomanPlus,
      Math.floor(sampleBuy * fees.buyFeePercentPlus)
    );
    return { sampleBuy, freeFee, plusFee };
  }, [fees]);

  const setFee = <K extends keyof typeof fees>(key: K, value: number) => {
    setFees((f) => ({ ...f, [key]: value }));
  };

  const onSave = async () => {
    setLoading(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/commerce-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fees, plus, referral, limits, reason }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "ذخیره ناموفق بود.");
        return;
      }
      setMsg("تنظیمات کارمزد و درآمد ذخیره شد.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setLoading(false);
    }
  };

  const onReset = () => {
    setFees(initial.fees);
    setPlus(initial.plus);
    setReferral(initial.referral);
    setLimits(initial.limits);
    setMsg("");
    setErr("");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5">
        <h2 className="font-bold">کارمزد معامله</h2>
        <p className="mt-1 text-[13px] text-white/45">
          درصد را به‌صورت اعشاری وارد کنید — مثلاً ۰٫۷٪ = <span dir="ltr">0.007</span>
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="درصد کارمزد خرید — رایگان">
            <NumberInput
              value={fees.buyFeePercentFree}
              step="0.001"
              onChange={(n) => setFee("buyFeePercentFree", n)}
            />
          </Field>
          <Field label="حداقل کارمزد خرید — رایگان (تومان)">
            <NumberInput
              value={fees.buyFeeMinTomanFree}
              onChange={(n) => setFee("buyFeeMinTomanFree", n)}
              words
            />
          </Field>
          <Field label="درصد کارمزد خرید — پلاس">
            <NumberInput
              value={fees.buyFeePercentPlus}
              step="0.001"
              onChange={(n) => setFee("buyFeePercentPlus", n)}
            />
          </Field>
          <Field label="حداقل کارمزد خرید — پلاس (تومان)">
            <NumberInput
              value={fees.buyFeeMinTomanPlus}
              onChange={(n) => setFee("buyFeeMinTomanPlus", n)}
              words
            />
          </Field>
          <Field label="درصد کارمزد فروش — رایگان">
            <NumberInput
              value={fees.sellFeePercentFree}
              step="0.001"
              onChange={(n) => setFee("sellFeePercentFree", n)}
            />
          </Field>
          <Field label="حداقل کارمزد فروش — رایگان (تومان)">
            <NumberInput
              value={fees.sellFeeMinTomanFree}
              onChange={(n) => setFee("sellFeeMinTomanFree", n)}
              words
            />
          </Field>
          <Field label="درصد کارمزد فروش — پلاس">
            <NumberInput
              value={fees.sellFeePercentPlus}
              step="0.001"
              onChange={(n) => setFee("sellFeePercentPlus", n)}
            />
          </Field>
          <Field label="حداقل کارمزد فروش — پلاس (تومان)">
            <NumberInput
              value={fees.sellFeeMinTomanPlus}
              onChange={(n) => setFee("sellFeeMinTomanPlus", n)}
              words
            />
          </Field>
          <Field label="کارمزد برداشت — رایگان (تومان)">
            <NumberInput
              value={fees.withdrawFeeTomanFree}
              onChange={(n) => setFee("withdrawFeeTomanFree", n)}
              words
            />
          </Field>
          <Field label="کارمزد برداشت — پلاس (تومان)">
            <NumberInput
              value={fees.withdrawFeeTomanPlus}
              onChange={(n) => setFee("withdrawFeeTomanPlus", n)}
              words
            />
          </Field>
        </div>
        <p className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 text-[12px] text-white/65">
          پیش‌نمایش خرید ۱۰ میلیون تومانی: رایگان{" "}
          <span className="text-gold tabular-nums">
            {preview.freeFee.toLocaleString("fa-IR")}
          </span>{" "}
          تومان · پلاس{" "}
          <span className="text-gold tabular-nums">
            {preview.plusFee.toLocaleString("fa-IR")}
          </span>{" "}
          تومان
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5">
        <h2 className="font-bold">گرم پلاس</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="قیمت ماهانه (تومان)">
            <NumberInput
              value={plus.monthlyPriceToman}
              onChange={(n) => setPlus((p) => ({ ...p, monthlyPriceToman: n }))}
              words
            />
          </Field>
          <Field label="حداکثر طرح پس‌انداز فعال — رایگان">
            <NumberInput
              value={plus.maxDcaFree}
              onChange={(n) => setPlus((p) => ({ ...p, maxDcaFree: n }))}
            />
          </Field>
          <Field label="حداکثر طرح پس‌انداز فعال — پلاس">
            <NumberInput
              value={plus.maxDcaPlus}
              onChange={(n) => setPlus((p) => ({ ...p, maxDcaPlus: n }))}
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-white/70">
            <input
              type="checkbox"
              checked={plus.smsAlertsPlusOnly}
              onChange={(e) =>
                setPlus((p) => ({ ...p, smsAlertsPlusOnly: e.target.checked }))
              }
            />
            اعلان SMS فقط برای پلاس
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5">
        <h2 className="font-bold">پاداش دعوت دوستان</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="سهم دعوت‌کننده از کارمزد دوستان" hint="اعشاری — ۱۵٪ = 0.15">
            <NumberInput
              value={referral.feeSharePercent}
              step="0.01"
              onChange={(n) => setReferral((r) => ({ ...r, feeSharePercent: n }))}
            />
          </Field>
          <div className="self-end pb-2 text-[12px] text-white/60">
            پاداش فقط به دعوت‌کننده‌ای با احراز کامل (شاهکار + کارت) واریز می‌شود.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5">
        <h2 className="font-bold">سقف تراکنش روزانه هر کاربر</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="سقف خرید روزانه (تومان)">
            <NumberInput
              value={limits.dailyBuyToman}
              onChange={(n) => setLimits((l) => ({ ...l, dailyBuyToman: n }))}
              words
            />
          </Field>
          <Field label="سقف فروش روزانه (تومان)">
            <NumberInput
              value={limits.dailySellToman}
              onChange={(n) => setLimits((l) => ({ ...l, dailySellToman: n }))}
              words
            />
          </Field>
          <Field label="سقف برداشت روزانه (تومان)">
            <NumberInput
              value={limits.dailyWithdrawToman}
              onChange={(n) => setLimits((l) => ({ ...l, dailyWithdrawToman: n }))}
              words
            />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5">
        <h2 className="font-bold">دلیل تغییر (الزامی — audit)</h2>
        <textarea
          required
          minLength={8}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="چرا این مقادیر عوض می‌شوند؟"
          className="mt-3 h-20 w-full rounded-xl border border-white/10 bg-[#070B12] p-3 text-[13px] outline-none focus:border-gold"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <GoldButton type="button" disabled={loading} onClick={() => void onSave()}>
          {loading ? "در حال ذخیره..." : "ذخیره تنظیمات"}
        </GoldButton>
        <GoldButton type="button" variant="secondary" disabled={loading} onClick={onReset}>
          بازگردانی
        </GoldButton>
        {msg && <p className="text-[13px] text-positive">{msg}</p>}
        {err && (
          <p className="text-[13px] text-negative" role="alert">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
