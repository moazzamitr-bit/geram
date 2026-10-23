"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Timeline } from "@/components/app/Timeline";
import { useAuth, type KycStatus } from "@/lib/auth/auth-context";

const levels: { status: KycStatus; title: string; desc: string }[] = [
  {
    status: "UNVERIFIED",
    title: "سطح پایه",
    desc: "خرید محدود با کیف پول؛ بدون برداشت بانکی.",
  },
  {
    status: "PENDING",
    title: "در حال بررسی",
    desc: "اطلاعات ارسال شده و در صف بررسی است.",
  },
  {
    status: "VERIFIED",
    title: "تأییدشده",
    desc: "سقف بالاتر، پس از اتصال برداشت و تحویل.",
  },
];

export default function KycPage() {
  const { user } = useAuth();
  const status = user?.kycStatus ?? "UNVERIFIED";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="احراز هویت"
        description="وضعیت هویت از حساب شما خوانده می‌شود. تأیید یا رد از داخل برنامه انجام نمی‌شود."
        backHref="/app/profile"
      />

      <AppCard>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">وضعیت فعلی</h2>
          <StatusBadge status={status} />
        </div>
        <div className="mt-5">
          <Timeline
            items={[
              { label: "ثبت‌نام و شماره موبایل", done: true },
              {
                label: "ارسال اطلاعات هویتی",
                done: status !== "UNVERIFIED",
              },
              {
                label: "بررسی",
                done: status === "VERIFIED" || status === "REJECTED",
              },
              { label: "فعال‌سازی سقف کامل", done: status === "VERIFIED" },
            ]}
          />
        </div>
        <p className="mt-4 text-[13px] leading-7 text-muted-app">
          {status === "VERIFIED"
            ? "هویت این حساب تأیید شده است."
            : status === "PENDING"
              ? "درخواست در صف بررسی است."
              : status === "REJECTED" || status === "NEEDS_UPDATE"
                ? "احراز هویت نیاز به اصلاح دارد. نتیجه را پشتیبانی اعلام می‌کند."
                : "سرویس استعلام هویت هنوز به این صفحه وصل نیست."}
        </p>
      </AppCard>

      <AppCard>
        <h2 className="text-[15px] font-bold">سطوح دسترسی</h2>
        <ul className="mt-4 space-y-3">
          {levels.map((level) => (
            <li
              key={level.status}
              className={`rounded-xl border px-3 py-3 ${
                status === level.status ? "border-gold/35 bg-gold/5" : "border-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-text">{level.title}</p>
                <StatusBadge status={level.status} />
              </div>
              <p className="mt-1 text-[12px] text-muted-app">{level.desc}</p>
            </li>
          ))}
        </ul>
      </AppCard>
    </div>
  );
}
