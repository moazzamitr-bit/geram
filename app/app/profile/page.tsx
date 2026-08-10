"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { SimulationBadge } from "@/components/app/SimulationBadge";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { formatMaskedPhone, useAuth } from "@/lib/auth/auth-context";
import { useDemoStore } from "@/lib/app/demo-store";
import {
  Building2,
  ChevronLeft,
  FileText,
  Fingerprint,
  Lock,
  MonitorSmartphone,
  Scale,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/app/profile/kyc", label: "احراز هویت", desc: "سطح دسترسی و سقف‌ها", icon: Fingerprint },
  { href: "/app/profile/security", label: "امنیت حساب", desc: "ورود و اعلان‌ها", icon: Lock },
  { href: "/app/profile/bank-accounts", label: "حساب‌های بانکی", desc: "واریز و برداشت", icon: Building2 },
  { href: "/app/profile/sessions", label: "نشست‌های فعال", desc: "دستگاه‌ها و ورودها", icon: MonitorSmartphone },
  { href: "/app/profile/documents", label: "اسناد", desc: "رسیدها و گزارش‌ها", icon: FileText },
  { href: "/app/profile/consents", label: "رضایت‌نامه‌ها", desc: "قوانین و حریم خصوصی", icon: Scale },
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const store = useDemoStore();
  const router = useRouter();
  const [referralInput, setReferralInput] = useState("");
  const [refMsg, setRefMsg] = useState("");
  const [plusMsg, setPlusMsg] = useState("");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="حساب من" action={<SimulationBadge />} />

      <AppCard>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[20px] font-extrabold text-text">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="mt-1 text-[13px] text-muted-app" dir="ltr">
              {user?.phone ? formatMaskedPhone(user.phone) : "—"}
            </p>
          </div>
          <StatusBadge status={user?.kycStatus ?? "UNVERIFIED"} />
        </div>
        <dl className="mt-5 space-y-3 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-muted-app">حساب بانکی تأییدشده</dt>
            <dd>{store.bankAccounts.filter((b) => b.verified).length.toLocaleString("fa-IR")}</dd>
          </div>
        </dl>
      </AppCard>

      <AppCard>
        <h2 className="text-[15px] font-bold text-text">گرم پلاس</h2>
        <p className="mt-2 text-[13px] text-muted-app">
          کارمزد کمتر، چند برنامه DCA، هشدار SMS و خرید خودکار پس از هشدار.
        </p>
        <p className="mt-2 text-[13px]">
          وضعیت:{" "}
          <span className={store.plusActive ? "text-positive" : "text-muted-app"}>
            {store.plusActive ? "فعال" : "رایگان"}
          </span>
        </p>
        {store.referralCode && (
          <p className="mt-2 text-[13px] text-muted-app">
            کد دعوت شما:{" "}
            <span dir="ltr" className="font-mono text-gold">
              {store.referralCode}
            </span>
          </p>
        )}
        {!store.plusActive && (
          <GoldButton
            type="button"
            size="sm"
            className="mt-4"
            onClick={async () => {
              const res = await store.activatePlusSandbox();
              setPlusMsg(res.message ?? res.error ?? "");
            }}
          >
            فعال‌سازی آزمایشی (۳۰ روز)
          </GoldButton>
        )}
        {plusMsg && <p className="mt-2 text-[13px] text-positive">{plusMsg}</p>}
        <label className="mt-5 block text-[13px]">
          <span className="text-muted-app">کد دعوت دوست</span>
          <input
            dir="ltr"
            value={referralInput}
            onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-3 font-mono outline-none focus:border-gold"
            placeholder="XXXXXXXX"
          />
        </label>
        <GoldButton
          type="button"
          size="sm"
          variant="secondary"
          className="mt-3"
          onClick={async () => {
            const res = await store.applyReferralCode(referralInput);
            setRefMsg(res.message ?? res.error ?? "");
          }}
        >
          ثبت کد دعوت
        </GoldButton>
        {refMsg && (
          <p className={`mt-2 text-[13px] ${refMsg.includes("خطا") || refMsg.includes("invalid") ? "text-negative" : "text-positive"}`}>
            {refMsg}
          </p>
        )}
      </AppCard>

      <div className="space-y-2">
        {links.map((item) => (
          <Link key={item.href} href={item.href}>
            <AppCard className="mb-2 flex items-center gap-3 transition hover:border-gold/30">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-gold">
                <item.icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text">{item.label}</p>
                <p className="text-[12px] text-muted-app">{item.desc}</p>
              </div>
              <ChevronLeft size={16} className="text-muted-app" />
            </AppCard>
          </Link>
        ))}
      </div>

      <GoldButton
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => {
          logout();
          router.push("/auth/login");
        }}
      >
        خروج از حساب
      </GoldButton>
    </div>
  );
}
