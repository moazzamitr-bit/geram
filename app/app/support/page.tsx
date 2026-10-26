"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useAppData } from "@/lib/app/app-data";
import { Headphones } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const categories = [
  "خرید",
  "فروش",
  "پرداخت",
  "برداشت",
  "تحویل فیزیکی",
  "احراز هویت",
  "امنیت",
  "سایر",
];

export default function SupportPage() {
  const store = useAppData();
  const router = useRouter();
  const [category, setCategory] = useState(categories[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="پشتیبانی" description="درخواست خود را ثبت کنید. پاسخ، فقط پیام واقعی پشتیبانی است." />

      <AppCard className="space-y-3">
        <label className="block text-[13px]">
          <span className="text-muted-app">دسته</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block text-[13px]">
          <span className="text-muted-app">موضوع</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 outline-none focus:border-gold"
          />
        </label>
        <label className="block text-[13px]">
          <span className="text-muted-app">پیام</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 py-2 outline-none focus:border-gold"
          />
        </label>
        <GoldButton
          type="button"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            if (!subject.trim() || !message.trim()) {
              setNote({ ok: false, text: "موضوع و متن پیام را وارد کنید." });
              return;
            }
            setBusy(true);
            const res = await store.createTicket(category, subject, message);
            setBusy(false);
            if (!res.ok || !res.id) {
              setNote({ ok: false, text: res.error ?? "ثبت تیکت انجام نشد." });
              return;
            }
            setNote({ ok: true, text: res.message ?? "تیکت ثبت شد." });
            router.push(`/app/support/${res.id}`);
          }}
        >
          {busy ? "در حال ثبت…" : "ثبت تیکت"}
        </GoldButton>
        {note && (
          <p role="status" className={`text-[13px] ${note.ok ? "text-emerald-700" : "text-rose-700"}`}>
            {note.text}
          </p>
        )}
      </AppCard>

      {store.userDataError && (
        <p role="alert" className="rounded-xl border border-rose-600/30 bg-rose-600/5 px-3 py-2 text-[13px] text-rose-700">
          {store.userDataError}{" "}
          <button type="button" className="underline" onClick={() => void store.refreshUserData()}>
            تلاش دوباره
          </button>
        </p>
      )}
      {store.tickets.length === 0 ? (
        <EmptyState title="تیکتی ندارید" description="سؤال یا مشکل خود را ثبت کنید." icon={Headphones} />
      ) : (
        <div className="space-y-3">
          {store.tickets.map((t) => (
            <Link key={t.id} href={`/app/support/${t.id}`}>
              <AppCard className="flex items-center justify-between hover:border-gold/30">
                <div>
                  <p className="font-medium text-text">{t.subject}</p>
                  <p className="mt-1 text-[12px] text-muted-app">
                    {t.category} · {t.createdAt}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </AppCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
