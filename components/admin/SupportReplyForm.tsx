"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoldButton } from "@/components/ui/GoldButton";

export function SupportReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("WAITING_USER");
  const [internal, setInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/support/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          body,
          status: internal ? "" : status,
          internal: internal ? "1" : "0",
          reason: internal ? "internal note" : "support reply",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || data.ok === false) {
        setErr(data.error || "ناموفق");
        return;
      }
      setMsg(data.message || "ثبت شد.");
      setBody("");
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "خطا");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-white/10 bg-[#0F1724] p-4">
      <textarea
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={internal ? "یادداشت داخلی — به کاربر نشان داده نمی‌شود" : "پاسخ به کاربر"}
        className="h-28 w-full rounded-xl border border-white/10 bg-[#070B12] p-3 text-[13px] outline-none focus:border-gold"
      />
      <label className="flex items-center gap-2 text-[13px] text-white/70">
        <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
        یادداشت داخلی (فقط audit)
      </label>
      {!internal ? (
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-xl border border-white/10 bg-[#070B12] px-3 text-[13px]"
        >
          <option value="OPEN">OPEN</option>
          <option value="WAITING_USER">PENDING_USER</option>
          <option value="WAITING_INTERNAL">PENDING_INTERNAL</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
      ) : null}
      <GoldButton type="submit" size="sm" disabled={loading}>
        {loading ? "…" : internal ? "ثبت یادداشت داخلی" : "ارسال پاسخ"}
      </GoldButton>
      {msg && <p className="text-[12px] text-positive">{msg}</p>}
      {err && <p className="text-[12px] text-negative">{err}</p>}
    </form>
  );
}
