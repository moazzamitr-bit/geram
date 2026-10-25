"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { formatMaskedPhone, useAuth } from "@/lib/auth/auth-context";
import { useDemoStore } from "@/lib/app/demo-store";
import {
  Building2,
  ChevronLeft,
  FileText,
  Fingerprint,
  Gauge,
  Gift,
  Lock,
  MonitorSmartphone,
  Package,
  Scale,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const links = [
  { href: "/app/referral", label: "معرفی دوستان", desc: "کد دعوت و سهم شما از کارمزد", icon: Gift },
  { href: "/app/delivery", label: "برداشت فیزیکی", desc: "تحویل حضوری سکه و شمش", icon: Package },
  { href: "/app/profile/kyc", label: "احراز هویت", desc: "سطح دسترسی و سقف‌ها", icon: Fingerprint },
  { href: "/app/profile/limits", label: "سقف تراکنش‌ها", desc: "خرید، فروش و برداشت امروز", icon: Gauge },
  { href: "/app/profile/security", label: "امنیت حساب", desc: "ورود و اعلان‌ها", icon: Lock },
  { href: "/app/profile/bank-accounts", label: "حساب‌های بانکی", desc: "واریز و برداشت", icon: Building2 },
  { href: "/app/profile/sessions", label: "نشست‌های فعال", desc: "دستگاه‌ها و ورودها", icon: MonitorSmartphone },
  { href: "/app/reports", label: "گزارش‌ها", desc: "ریز معاملات، خروجی اکسل و ماشین‌حساب قیمت", icon: FileText },
  { href: "/app/profile/consents", label: "رضایت‌نامه‌ها", desc: "قوانین و حریم خصوصی", icon: Scale },
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const store = useDemoStore();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="حساب من" />

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
