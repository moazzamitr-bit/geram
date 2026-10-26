"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useAppData } from "@/lib/app/app-data";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const store = useAppData();
  const ticket = store.tickets.find((t) => t.id === id);
  const [text, setText] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ticket) return <PageHeader title="تیکت یافت نشد" backHref="/app/support" />;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title={ticket.subject} backHref="/app/support" />
      <AppCard>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted-app">{ticket.category}</span>
          <StatusBadge status={ticket.status} />
        </div>
        <div className="mt-5 space-y-3">
          {ticket.messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-xl px-3 py-2 text-[13px] ${
                m.from === "user"
                  ? "bg-gold/10 text-text"
                  : "bg-white/[0.04] text-text-secondary"
              }`}
            >
              <p>{m.text}</p>
              <p className="mt-1 text-[11px] text-muted-app">{m.at}</p>
            </div>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="mt-4 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 py-2 outline-none focus:border-gold"
          placeholder="پاسخ شما..."
        />
        <GoldButton
          type="button"
          size="sm"
          className="mt-3"
          disabled={busy}
          onClick={async () => {
            if (!text.trim()) return;
            setBusy(true);
            const res = await store.replyTicket(ticket.id, text);
            setBusy(false);
            if (!res.ok) {
              setNote({ ok: false, text: res.error ?? "ارسال پیام انجام نشد." });
              return;
            }
            setText("");
            setNote({ ok: true, text: res.message ?? "پیام شما ارسال شد." });
          }}
        >
          {busy ? "در حال ارسال…" : "ارسال"}
        </GoldButton>
        {note && (
          <p role="status" className={`mt-2 text-[13px] ${note.ok ? "text-emerald-700" : "text-rose-700"}`}>
            {note.text}
          </p>
        )}
      </AppCard>
    </div>
  );
}
