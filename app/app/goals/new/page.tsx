"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { GoldButton } from "@/components/ui/GoldButton";
import { useDemoStore } from "@/lib/app/demo-store";
import { useRouter } from "next/navigation";
import { useState } from "react";

const presets = [
  "خرید خودرو",
  "ازدواج",
  "سفر",
  "خانه",
  "تحصیل",
  "آینده فرزند",
  "صندوق اضطراری",
  "هدف شخصی",
];

export default function NewGoalPage() {
  const store = useDemoStore();
  const router = useRouter();
  const [name, setName] = useState(presets[0]);
  const [targetRial, setTargetRial] = useState(100_000_000);
  const [monthlyRial, setMonthlyRial] = useState(5_000_000);
  const [targetDate, setTargetDate] = useState("اسفند ۱۴۰۴");

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="هدف جدید" backHref="/app/goals" />
      <AppCard>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setName(p)}
              className={`rounded-full px-3 py-1.5 text-[12px] ${
                name === p ? "bg-gold/15 text-gold" : "border border-white/10 text-muted-app"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <label className="mt-5 block text-[13px]">
          <span className="text-muted-app">نام هدف</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 outline-none focus:border-gold"
          />
        </label>
        <label className="mt-4 block text-[13px]">
          <span className="text-muted-app">مبلغ هدف (تومان)</span>
          <input
            dir="ltr"
            value={targetRial}
            onChange={(e) => setTargetRial(Number(e.target.value.replace(/\D/g, "") || 0))}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
          />
        </label>
        <label className="mt-4 block text-[13px]">
          <span className="text-muted-app">پس‌انداز ماهانه پیشنهادی</span>
          <input
            dir="ltr"
            value={monthlyRial}
            onChange={(e) => setMonthlyRial(Number(e.target.value.replace(/\D/g, "") || 0))}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
          />
        </label>
        <label className="mt-4 block text-[13px]">
          <span className="text-muted-app">بازه زمانی</span>
          <input
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 outline-none focus:border-gold"
          />
        </label>
        <GoldButton
          type="button"
          className="mt-6 w-full"
          onClick={() => {
            const id = store.addGoal({ name, targetRial, monthlyRial, targetDate });
            router.push(`/app/goals/${id}`);
          }}
        >
          ایجاد هدف
        </GoldButton>
      </AppCard>
    </div>
  );
}
