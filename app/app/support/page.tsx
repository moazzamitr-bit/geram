"use client";

import { AppCard } from "@/components/app/AppCard";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
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
  const store = useDemoStore();
  const router = useRouter();
  const [category, setCategory] = useState(categories[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="پشتیبانی" description="درخواست خود را ثبت کنید؛ پاسخ در سندباکس شبیه‌سازی می‌شود." />

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
          onClick={() => {
            if (!subject.trim() || !message.trim()) return;
            const id = store.createTicket(category, subject, message);
            router.push(`/app/support/${id}`);
          }}
        >
          ثبت تیکت
        </GoldButton>
      </AppCard>

      {store.tickets.length === 0 ? (
        <EmptyState title="تیکتی ندارید" description="سؤال یا مشکل خود را ثبت کنید؛ پاسخ سندباکس شبیه‌سازی می‌شود." icon={Headphones} />
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
