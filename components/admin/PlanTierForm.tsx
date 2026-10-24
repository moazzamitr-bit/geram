"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoldButton } from "@/components/ui/GoldButton";

export function PlanTierForm({ userId, current }: { userId: string; current: string }) {
  const router = useRouter();
  const [tier, setTier] = useState(current === "plus" ? "plus" : "free");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-2 rounded-xl border border-white/10 bg-[#070B12] p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setMsg("");
        setErr("");
        try {
          const res = await fetch("/api/admin/users/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, planTier: tier, reason }),
          });
          const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
          if (!res.ok || data.ok === false) {
            setErr(data.error || data.message || "ناموفق");
            return;
          }
          setMsg(data.message || "ثبت شد.");
          setReason("");
          router.refresh();
        } catch (error) {
          setErr(error instanceof Error ? error.message : "خطا");
        } finally {
          setLoading(false);
        }
      }}
    >
      <p className="text-[12px] text-white/60">پلن فعلی: {current === "plus" ? "پلاس" : "رایگان"}</p>
      <select
        value={tier}
        onChange={(event) => setTier(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 text-[13px] outline-none focus:border-gold"
      >
        <option value="free">رایگان (لغو پلاس)</option>
        <option value="plus">پلاس</option>
      </select>
      <textarea
        required
        minLength={8}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="دلیل تغییر پلن، حداقل ۸ حرف"
        className="h-20 w-full rounded-xl border border-white/10 bg-[#0B1220] p-3 text-[13px] outline-none focus:border-gold"
      />
      <GoldButton type="submit" size="sm" disabled={loading}>
        {loading ? "…" : "ثبت پلن"}
      </GoldButton>
      {msg && <p className="text-[12px] text-positive">{msg}</p>}
      {err && <p className="text-[12px] text-negative">{err}</p>}
    </form>
  );
}
