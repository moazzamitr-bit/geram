"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoldButton } from "@/components/ui/GoldButton";
import { AmountField } from "@/components/ui/AmountField";
import { amountCanonical } from "@/lib/format/amount";

const OPTIONS = [
  { value: "GOLD", label: "طلا (گرم)" },
  { value: "SILVER", label: "نقره (گرم)" },
  { value: "COPPER", label: "مس (گرم)" },
  { value: "IRR", label: "نقدینگی عملیاتی (تومان)" },
] as const;

function newKey() {
  return crypto.randomUUID();
}

/**
 * One admin posts opening metal (PLATFORM_AVAILABLE) or operating cash
 * (PLATFORM_CASH_CONTROL). The same idempotency key posts once.
 */
export function InventoryRequestForm() {
  const router = useRouter();
  const [asset, setAsset] = useState<string>("GOLD");
  const [amount, setAmount] = useState(0);
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setErr("");
    const cash = asset === "IRR";
    const canonical = amountCanonical(amount, cash ? 0 : 6);
    if (!canonical) {
      setErr(cash ? "مبلغ تومان را وارد کنید." : "وزن را به گرم وارد کنید.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          kind: "INVENTORY_ADJUSTMENT",
          asset,
          amount: canonical,
          direction: "IN",
          evidence,
          idempotencyKey,
          reason,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || data.ok === false) {
        setErr(data.error || "ناموفق");
        if (res.status === 409) setIdempotencyKey(newKey());
        return;
      }
      setMsg(data.message || "ثبت شد.");
      setAmount(0);
      setEvidence("");
      setReason("");
      setIdempotencyKey(newKey());
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "خطا");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-white/10 bg-[#070B12] p-4">
      <p className="text-[13px] font-bold">ثبت موجودی اولیه خزانه</p>
      <p className="text-[12px] leading-6 text-white/45">
        فقط فلز یا نقدینگی‌ای که واقعاً در اختیار شرکت است. با ثبت، ژورنال APPROVED_OPENING_BALANCE
        همین حالا به موجودی قابل فروش (PLATFORM_AVAILABLE) یا نقد عملیاتی (PLATFORM_CASH_CONTROL) می‌نشیند.
        جدول wallets عوض نمی‌شود. تکرار همان درخواست موجودی را دوباره زیاد نمی‌کند.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={asset}
          onChange={(e) => {
            setAsset(e.target.value);
            setAmount(0);
          }}
          className="h-11 rounded-xl border border-white/10 bg-[#0B1220] px-3 text-[13px] outline-none focus:border-gold"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <AmountField
          required
          aria-label={asset === "IRR" ? "مبلغ به تومان" : "وزن به گرم"}
          value={amount}
          decimals={asset === "IRR" ? 0 : 6}
          words={asset === "IRR"}
          wordsClassName="text-[12px] text-white/65"
          onValueChange={setAmount}
          placeholder={asset === "IRR" ? "مبلغ به تومان" : "گرم"}
          className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 text-left tabular-nums text-[13px] text-white outline-none focus:border-gold"
        />
      </div>
      <input
        value={evidence}
        onChange={(e) => setEvidence(e.target.value)}
        placeholder="مدرک (شماره فاکتور، رسید خزانه، ...)"
        className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 text-[13px] outline-none focus:border-gold"
      />
      <textarea
        required
        minLength={8}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="دلیل (الزامی، حداقل ۸ نویسه)"
        className="h-16 w-full rounded-xl border border-white/10 bg-[#0B1220] p-3 text-[13px] outline-none focus:border-gold"
      />
      <GoldButton type="submit" size="sm" disabled={loading}>
        {loading ? "…" : "ثبت در دفترکل"}
      </GoldButton>
      {msg && <p className="text-[12px] text-positive">{msg}</p>}
      {err && <p className="text-[12px] text-negative">{err}</p>}
    </form>
  );
}
