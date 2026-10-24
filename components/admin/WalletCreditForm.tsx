"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoldButton } from "@/components/ui/GoldButton";

function newKey() {
  return crypto.randomUUID();
}

/**
 * Closed-beta wallet credit. Submit posts USER_AVAILABLE immediately.
 * The same idempotency key credits the ledger once.
 */
export function WalletCreditForm({
  userId: lockedUserId,
  lockUserId = false,
}: {
  userId?: string;
  lockUserId?: boolean;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState(lockedUserId ?? "");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
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
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          kind: "FINANCIAL_ADJUSTMENT",
          userId: userId.trim(),
          phone: phone.trim(),
          amount: amount.trim(),
          idempotencyKey,
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
      setReason("");
      if (!lockUserId) setPhone("");
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
      <p className="text-[13px] font-bold">شارژ دستی کیف پول</p>
      <p className="text-[12px] leading-6 text-white/45">
        با ثبت شارژ، ژورنال APPROVED_OPENING_BALANCE همین حالا به موجودی قابل استفاده (USER_AVAILABLE) می‌نشیند.
        جدول wallets مستقیم عوض نمی‌شود. تکرار همان درخواست موجودی را دوباره زیاد نمی‌کند. کاربر باید قبلاً یک بار وارد شده باشد.
      </p>
      <input
        dir="ltr"
        value={userId}
        readOnly={lockUserId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="شناسه کاربر (UUID)"
        className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 text-left font-mono text-[13px] outline-none focus:border-gold read-only:text-white/60"
      />
      {!lockUserId && (
        <input
          dir="ltr"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="یا شماره موبایل 09…"
          className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 text-left text-[13px] outline-none focus:border-gold"
        />
      )}
      <input
        required
        dir="ltr"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        placeholder="مبلغ به تومان"
        className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 text-left tabular-nums text-[13px] outline-none focus:border-gold"
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
        {loading ? "…" : "ثبت شارژ"}
      </GoldButton>
      {msg && <p className="text-[12px] text-positive">{msg}</p>}
      {err && <p className="text-[12px] text-negative">{err}</p>}
    </form>
  );
}
