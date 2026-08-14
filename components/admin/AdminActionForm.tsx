"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoldButton } from "@/components/ui/GoldButton";

export function AdminActionForm({
  action,
  endpoint,
  extra,
  submitLabel,
  placeholder = "دلیل الزامی است",
  danger,
}: {
  action: string;
  endpoint: string;
  extra?: Record<string, string>;
  submitLabel: string;
  placeholder?: string;
  danger?: boolean;
}) {
  const router = useRouter();
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
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, ...extra }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || data.ok === false) {
        setErr(data.error || data.message || "ناموفق");
        return;
      }
      setMsg(data.message || "ثبت شد.");
      setReason("");
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "خطا");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-xl border border-white/10 bg-[#070B12] p-3">
      <textarea
        required
        minLength={8}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder}
        className="h-20 w-full rounded-xl border border-white/10 bg-[#0B1220] p-3 text-[13px] outline-none focus:border-gold"
      />
      <GoldButton type="submit" size="sm" disabled={loading} className={danger ? "bg-negative" : undefined}>
        {loading ? "…" : submitLabel}
      </GoldButton>
      {msg && <p className="text-[12px] text-positive">{msg}</p>}
      {err && <p className="text-[12px] text-negative">{err}</p>}
    </form>
  );
}
