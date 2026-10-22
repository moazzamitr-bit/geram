"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoldButton } from "@/components/ui/GoldButton";

const OPTIONS = [
  { value: "GOLD", label: "طلا (گرم)" },
  { value: "SILVER", label: "نقره (گرم)" },
  { value: "COPPER", label: "مس (گرم)" },
  { value: "IRR", label: "نقدینگی عملیاتی (تومان)" },
] as const;

/**
 * Maker step for an opening balance: the metal/cash the platform really holds.
 * A different admin approves, then "Execute journal" posts it to the ledger.
 */
export function InventoryRequestForm() {
  const router = useRouter();
  const [asset, setAsset] = useState<string>("GOLD");
  const [amount, setAmount] = useState("");
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          kind: "INVENTORY_ADJUSTMENT",
          asset,
          amount,
          direction: "IN",
          evidence,
          reason,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || data.ok === false) {
        setErr(data.error || "ناموفق");
        return;
      }
      setMsg(data.message || "ثبت شد.");
      setAmount("");
      setEvidence("");
      setReason("");
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
      <p className="text-[12px] text-white/45">
        فقط فلز یا نقدینگی‌ای که واقعاً در اختیار شرکت است. بدون این مرحله خرید مشتری با «موجودی کافی نیست» رد می‌شود.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
          className="h-11 rounded-xl border border-white/10 bg-[#0B1220] px-3 text-[13px] outline-none focus:border-gold"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          required
          dir="ltr"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="مقدار"
          className="h-11 rounded-xl border border-white/10 bg-[#0B1220] px-3 text-left tabular-nums text-[13px] outline-none focus:border-gold"
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
        placeholder="دلیل (الزامی)"
        className="h-16 w-full rounded-xl border border-white/10 bg-[#0B1220] p-3 text-[13px] outline-none focus:border-gold"
      />
      <GoldButton type="submit" size="sm" disabled={loading}>
        {loading ? "…" : "ثبت درخواست (نیازمند تأیید ادمین دوم)"}
      </GoldButton>
      {msg && <p className="text-[12px] text-positive">{msg}</p>}
      {err && <p className="text-[12px] text-negative">{err}</p>}
    </form>
  );
}
