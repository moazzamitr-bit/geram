"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Timeline } from "@/components/app/Timeline";
import { GoldButton } from "@/components/ui/GoldButton";
import { useAuth, type KycStatus } from "@/lib/auth/auth-context";
import { useState } from "react";

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
    desc: "سقف بالاتر، برداشت و تحویل فیزیکی فعال.",
  },
];

export default function KycPage() {
  const { user, setKycStatus } = useAuth();
  const [nationalId, setNationalId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [msg, setMsg] = useState("");

  const status = user?.kycStatus ?? "UNVERIFIED";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="احراز هویت"
        description="در سندباکس، وضعیت KYC شبیه‌سازی می‌شود و به سیستم واقعی وصل نیست."
        backHref="/app/profile"
        action={<SimulationBadge />}
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
                label: "بررسی خودکار / دستی",
                done: status === "VERIFIED" || status === "REJECTED",
              },
              { label: "فعال‌سازی سقف کامل", done: status === "VERIFIED" },
            ]}
          />
        </div>
      </AppCard>

      {status === "UNVERIFIED" && (
        <AppCard className="space-y-3">
          <h2 className="text-[15px] font-bold">شروع احراز هویت</h2>
          <label className="block text-[13px]">
            <span className="text-muted-app">کد ملی</span>
            <input
              dir="ltr"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 text-left outline-none focus:border-gold"
              placeholder="0012345678"
            />
          </label>
          <label className="block text-[13px]">
            <span className="text-muted-app">تاریخ تولد</span>
            <input
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 outline-none focus:border-gold"
              placeholder="۱۳۷۰/۰۱/۰۱"
            />
          </label>
          <GoldButton
            type="button"
            className="w-full"
            onClick={() => {
              if (nationalId.length !== 10 || !birthDate.trim()) {
                setMsg("کد ملی ۱۰ رقمی و تاریخ تولد را وارد کنید.");
                return;
              }
              setKycStatus("PENDING");
              setMsg("درخواست ارسال شد. در سندباکس می‌توانید تأیید را شبیه‌سازی کنید.");
            }}
          >
            ارسال برای بررسی
          </GoldButton>
          {msg && <p className="text-[13px] text-muted-app">{msg}</p>}
        </AppCard>
      )}

      {status === "PENDING" && (
        <AppCard className="space-y-3">
          <p className="text-[13px] leading-7 text-text-secondary">
            درخواست شما در صف بررسی است. برای ادامه دمو، تأیید یا رد را شبیه‌سازی کنید.
          </p>
          <div className="flex flex-wrap gap-3">
            <GoldButton type="button" onClick={() => setKycStatus("VERIFIED")}>
              شبیه‌سازی تأیید
            </GoldButton>
            <GoldButton
              type="button"
              variant="secondary"
              onClick={() => setKycStatus("NEEDS_UPDATE")}
            >
              نیاز به اصلاح
            </GoldButton>
          </div>
        </AppCard>
      )}

      {(status === "NEEDS_UPDATE" || status === "REJECTED") && (
        <AppCard className="space-y-3">
          <p className="text-[13px] text-warning">
            احراز هویت نیاز به اصلاح دارد. اطلاعات را دوباره ارسال کنید.
          </p>
          <GoldButton type="button" onClick={() => setKycStatus("UNVERIFIED")}>
            شروع مجدد
          </GoldButton>
        </AppCard>
      )}

      {status === "VERIFIED" && (
        <AppCard>
          <p className="text-[13px] leading-7 text-positive">
            احراز هویت تأیید شد. سقف‌های بالاتر، برداشت بانکی و تحویل فیزیکی در سندباکس فعال است.
          </p>
        </AppCard>
      )}

      <AppCard>
        <h2 className="text-[15px] font-bold">سطوح دسترسی</h2>
        <ul className="mt-4 space-y-3">
          {levels.map((l) => (
            <li
              key={l.status}
              className={`rounded-xl border px-3 py-3 ${
                status === l.status ? "border-gold/35 bg-gold/5" : "border-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-text">{l.title}</p>
                <StatusBadge status={l.status} />
              </div>
              <p className="mt-1 text-[12px] text-muted-app">{l.desc}</p>
            </li>
          ))}
        </ul>
      </AppCard>
    </div>
  );
}
