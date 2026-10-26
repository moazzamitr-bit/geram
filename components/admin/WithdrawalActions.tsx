"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoldButton } from "@/components/ui/GoldButton";

const field = "h-9 w-full rounded-lg border border-white/10 bg-[#0A0C0E] px-2 text-[12px] text-white outline-none focus:border-gold";

/** Mark paid (needs the Paya/Satna reference) or reject (releases the reserve). */
export function WithdrawalActions({ id }: { id: string }) {
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (action: "pay" | "reject") => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, payoutRef: ref, note }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) return setErr(data.message || data.error || "ناموفق");
      setMsg(data.message || "ثبت شد.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-[230px] space-y-2 rounded-xl border border-white/10 bg-[#070B12] p-3">
      <input dir="ltr" className={field} placeholder="شماره پیگیری پایا / ساتنا" value={ref} onChange={(e) => setRef(e.target.value)} />
      <input className={field} placeholder="توضیح (برای رد الزامی)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <GoldButton type="button" size="sm" disabled={busy || ref.trim().length < 6} onClick={() => void send("pay")}>
          واریز شد
        </GoldButton>
        <GoldButton type="button" size="sm" variant="secondary" disabled={busy || note.trim().length < 4} onClick={() => void send("reject")}>
          رد و بازگشت مبلغ
        </GoldButton>
      </div>
      {msg ? <p className="text-[12px] text-positive">{msg}</p> : null}
      {err ? <p className="text-[12px] text-negative">{err}</p> : null}
    </div>
  );
}
