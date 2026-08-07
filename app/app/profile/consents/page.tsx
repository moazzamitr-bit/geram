"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { useState } from "react";

type Consent = {
  id: string;
  title: string;
  desc: string;
  required: boolean;
  accepted: boolean;
};

const initial: Consent[] = [
  {
    id: "terms",
    title: "قوانین استفاده",
    desc: "شرایط عمومی پلتفرم گرم برای سرمایه‌گذاری طلا.",
    required: true,
    accepted: true,
  },
  {
    id: "privacy",
    title: "حریم خصوصی",
    desc: "نحوه نگهداری و پردازش داده‌های شخصی.",
    required: true,
    accepted: true,
  },
  {
    id: "marketing",
    title: "پیام‌های اطلاع‌رسانی",
    desc: "اعلان قیمت و پیشنهادهای غیرضروری محصول.",
    required: false,
    accepted: false,
  },
  {
    id: "data",
    title: "اشتراک داده با شرکای اعتماد",
    desc: "فقط برای تطبیق پشتوانه و بیمه (سندباکس).",
    required: false,
    accepted: true,
  },
];

export default function ConsentsPage() {
  const [items, setItems] = useState(initial);
  const [saved, setSaved] = useState(false);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="رضایت‌نامه‌ها"
        description="می‌توانید رضایت‌های اختیاری را تغییر دهید."
        backHref="/app/profile"
        action={<SimulationBadge />}
      />

      <div className="space-y-3">
        {items.map((c) => (
          <AppCard key={c.id} className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-text">
                {c.title}
                {c.required && (
                  <span className="mr-2 text-[11px] text-muted-app">(الزامی)</span>
                )}
              </p>
              <p className="mt-1 text-[12px] leading-6 text-muted-app">{c.desc}</p>
            </div>
            <button
              type="button"
              disabled={c.required}
              onClick={() => {
                setItems((list) =>
                  list.map((x) =>
                    x.id === c.id ? { ...x, accepted: !x.accepted } : x
                  )
                );
                setSaved(false);
              }}
              className={`mt-1 h-6 w-11 shrink-0 rounded-full border transition ${
                c.accepted
                  ? "border-gold/40 bg-gold/30"
                  : "border-white/15 bg-white/[0.06]"
              } ${c.required ? "opacity-50" : ""}`}
              aria-pressed={c.accepted}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-text transition ${
                  c.accepted ? "translate-x-0" : "translate-x-5"
                }`}
              />
            </button>
          </AppCard>
        ))}
      </div>

      <GoldButton
        type="button"
        className="w-full"
        onClick={() => setSaved(true)}
      >
        ذخیره تغییرات
      </GoldButton>
      {saved && (
        <p className="text-center text-[13px] text-positive">تغییرات ذخیره شد (سندباکس).</p>
      )}
    </div>
  );
}
