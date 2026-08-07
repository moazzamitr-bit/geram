"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDemoStore();
  const ticket = store.tickets.find((t) => t.id === id);
  const [text, setText] = useState("");

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
          onClick={() => {
            if (!text.trim()) return;
            store.replyTicket(ticket.id, text);
            setText("");
          }}
        >
          ارسال
        </GoldButton>
      </AppCard>
    </div>
  );
}
