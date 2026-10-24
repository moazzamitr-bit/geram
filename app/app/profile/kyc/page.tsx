"use client";

import { AppCard } from "@/components/app/AppCard";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { GoldButton } from "@/components/ui/GoldButton";
import { formatMaskedPhone, useAuth, type KycStatus } from "@/lib/auth/auth-context";
import {
  isValidIranianNationalCode,
  normalizeJalaliBirthDate,
} from "@/lib/kyc/national-id";
import { KYC_LEVEL_CAPS, KYC_LEVEL_TITLES, type KycLevel } from "@/lib/kyc/levels";
import { KYC_MESSAGES, type KycErrorCode } from "@/lib/kyc/messages";
import { formatToman } from "@/lib/utils";
import { FormEvent, useEffect, useState } from "react";

const fieldClass =
  "h-12 w-full rounded-xl border border-black/10 bg-[#F6F4F1] px-4 text-[15px] text-text outline-none transition focus:border-[#FFB800] focus:bg-white";

const steps: { level: KycLevel; desc: string }[] = [
  { level: 0, desc: "شماره همین حساب با کد پیامکی تأیید شده است." },
  {
    level: 1,
    desc: "کد ملی و تاریخ تولد با شاهکار و ثبت احوال تطبیق می‌شود. سقف معامله سطح هویت باز می‌شود.",
  },
  {
    level: 2,
    desc: "کارت یا شبای به نام خودتان برای برداشت لازم است. سقف بالاتر با این سطح باز می‌شود.",
  },
];

function messageFor(code: string | undefined, fallback?: string) {
  if (fallback) return fallback;
  if (code && code in KYC_MESSAGES) return KYC_MESSAGES[code as KycErrorCode];
  return "احراز هویت انجام نشد. دوباره تلاش کنید.";
}

export default function KycPage() {
  const { user, applyKycResult } = useAuth();
  const status = user?.kycStatus ?? "UNVERIFIED";
  const [nationalCode, setNationalCode] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [card, setCard] = useState("");
  const [iban, setIban] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<KycLevel>(status === "VERIFIED" ? 1 : 0);

  useEffect(() => {
    if (status === "VERIFIED") {
      setLevel((current) => (current < 1 ? 1 : current));
    }
  }, [status]);
  const [bankMask, setBankMask] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/kyc/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { ok?: boolean; level?: KycLevel; bankMask?: string | null; firstName?: string; lastName?: string; status?: KycStatus }) => {
        if (!data.ok || data.level == null) return;
        setLevel(data.level);
        setBankMask(data.bankMask ?? null);
        if (data.status === "VERIFIED") {
          applyKycResult({
            kycStatus: "VERIFIED",
            firstName: data.firstName,
            lastName: data.lastName,
          });
        }
      })
      .catch(() => undefined);
  }, [applyKycResult]);

  const onStart = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!isValidIranianNationalCode(nationalCode)) {
      setError(KYC_MESSAGES.invalid_national_code);
      return;
    }
    if (!normalizeJalaliBirthDate(birthDate)) {
      setError(KYC_MESSAGES.invalid_birth_date);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/kyc/shahkar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalCode, birthDate }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        step?: string;
        error?: string;
        message?: string;
        firstName?: string;
        lastName?: string;
      };
      if (!res.ok || !data.ok) {
        setError(messageFor(data.error, data.message));
        return;
      }
      if (data.step === "verified") {
        applyKycResult({
          kycStatus: "VERIFIED",
          firstName: data.firstName,
          lastName: data.lastName,
        });
        setInfo("هویت شما تأیید شد.");
        setStep("form");
        return;
      }
      setStep("otp");
      setInfo("اگر کد ملی با شماره موبایل این حساب یکی باشد، رمز شاهکار پیامک می‌شود.");
    } catch {
      setError(KYC_MESSAGES.unavailable);
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/kyc/shahkar/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        firstName?: string;
        lastName?: string;
      };
      if (!res.ok || !data.ok) {
        setError(messageFor(data.error, data.message));
        return;
      }
      applyKycResult({
        kycStatus: "VERIFIED",
        firstName: data.firstName,
        lastName: data.lastName,
      });
      setStep("form");
      setOtp("");
      setInfo("هویت شما تأیید شد.");
    } catch {
      setError(KYC_MESSAGES.unavailable);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="احراز هویت"
        description="مثل وال‌گلد و گرمی: اول موبایل، بعد کد ملی و تاریخ تولد، و برای برداشت کارت یا شبای به نام خودتان."
        backHref="/app/profile"
      />

      <AppCard>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">سطح فعلی: {KYC_LEVEL_TITLES[level]}</h2>
          <StatusBadge status={status} />
        </div>
        <p className="mt-4 text-[13px] leading-7 text-muted-app">
          {status === "VERIFIED"
            ? `هویت تأیید شده است${user?.firstName ? `: ${user.firstName} ${user.lastName}` : ""}.`
            : status === "REJECTED"
              ? "این کد ملی تأیید نشد. اگر اطلاعات را اشتباه وارد کرده‌اید با پشتیبانی تماس بگیرید."
              : `تطبیق با شماره ${user?.phone ? formatMaskedPhone(user.phone) : "همین حساب"} انجام می‌شود. سیم‌کارت باید به نام همین کد ملی باشد.`}
        </p>
      </AppCard>

      {status !== "VERIFIED" && step === "form" && (
        <AppCard>
          <form className="space-y-4" onSubmit={onStart}>
            <label className="block">
              <span className="mb-2 block text-[13px] text-text-secondary">کد ملی</span>
              <input
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                className={fieldClass}
                value={nationalCode}
                onChange={(event) => setNationalCode(event.target.value)}
                placeholder="۱۰ رقم"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] text-text-secondary">تاریخ تولد شمسی</span>
              <input
                dir="ltr"
                className={fieldClass}
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                placeholder="۱۳۷۰/۰۶/۱۵"
              />
            </label>
            {error && <p className="text-[13px] text-negative" role="alert">{error}</p>}
            {info && <p className="text-[13px] text-text-secondary">{info}</p>}
            <GoldButton type="submit" className="w-full" disabled={loading}>
              {loading ? "در حال استعلام…" : "تطبیق با شاهکار"}
            </GoldButton>
          </form>
        </AppCard>
      )}

      {status !== "VERIFIED" && step === "otp" && (
        <AppCard>
          <form className="space-y-4" onSubmit={onVerify}>
            <p className="text-[13px] leading-7 text-muted-app">
              رمز پیامک‌شده برای {user?.phone ? formatMaskedPhone(user.phone) : "شماره حساب"} را وارد کنید.
            </p>
            <input
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              className={fieldClass}
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="رمز پیامک"
            />
            {error && <p className="text-[13px] text-negative" role="alert">{error}</p>}
            {info && <p className="text-[13px] text-text-secondary">{info}</p>}
            <GoldButton type="submit" className="w-full" disabled={loading}>
              {loading ? "در حال بررسی…" : "تأیید رمز و استعلام نام"}
            </GoldButton>
            <button
              type="button"
              className="w-full text-[13px] text-muted-app"
              onClick={() => {
                setStep("form");
                setError("");
              }}
            >
              اصلاح کد ملی یا تاریخ تولد
            </button>
          </form>
        </AppCard>
      )}

      {status === "VERIFIED" && level < 2 && (
        <AppCard>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setInfo("");
              setLoading(true);
              try {
                const res = await fetch("/api/kyc/bank", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ card, iban }),
                });
                const data = (await res.json()) as { ok?: boolean; error?: string; message?: string; mask?: string };
                if (!res.ok || !data.ok) {
                  setError(messageFor(data.error, data.message));
                  return;
                }
                setLevel(2);
                setBankMask(data.mask ?? null);
                setInfo("حساب بانکی با کد ملی شما یکی است. سقف برداشت این سطح باز شد.");
              } catch {
                setError(KYC_MESSAGES.unavailable);
              } finally {
                setLoading(false);
              }
            }}
          >
            <h2 className="text-[15px] font-bold">کارت یا شبا برای برداشت</h2>
            <p className="text-[13px] leading-7 text-muted-app">
              شماره کارت و کد ملی باید مال یک نفر باشند. شماره کامل کارت ذخیره نمی‌شود.
            </p>
            <label className="block">
              <span className="mb-2 block text-[13px] text-text-secondary">شماره کارت</span>
              <input
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                className={fieldClass}
                value={card}
                onChange={(event) => setCard(event.target.value)}
                placeholder="۱۶ رقم"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] text-text-secondary">یا شماره شبا</span>
              <input
                dir="ltr"
                autoComplete="off"
                className={fieldClass}
                value={iban}
                onChange={(event) => setIban(event.target.value)}
                placeholder="IR..."
              />
            </label>
            {error && <p className="text-[13px] text-negative" role="alert">{error}</p>}
            {info && <p className="text-[13px] text-text-secondary">{info}</p>}
            <GoldButton type="submit" className="w-full" disabled={loading}>
              {loading ? "در حال تطبیق…" : "تطبیق مالکیت حساب"}
            </GoldButton>
          </form>
        </AppCard>
      )}

      {level >= 2 && (
        <AppCard>
          <h2 className="text-[15px] font-bold">حساب بانکی تأیید شد</h2>
          <p className="mt-3 text-[13px] leading-7 text-muted-app">{bankMask || "مالکیت کارت یا شبا ثبت شده است."}</p>
        </AppCard>
      )}

      <AppCard>
        <h2 className="text-[15px] font-bold">مراحل احراز</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((stepItem, index) => {
            const current = level === stepItem.level;
            const finished = stepItem.level < level;
            return (
              <li
                key={stepItem.level}
                className={`rounded-xl border px-3 py-3 ${
                  current ? "border-gold/35 bg-gold/5" : "border-black/[0.06]"
                }`}
              >
                <p className="text-[13px] font-medium text-text">
                  {index + 1}. {KYC_LEVEL_TITLES[stepItem.level]}
                  {finished ? " — انجام شد" : current ? " — مرحله فعلی" : ""}
                </p>
                <p className="mt-1 text-[12px] leading-6 text-muted-app">{stepItem.desc}</p>
                <p className="mt-2 text-[12px] text-text-secondary">
                  خرید روزانه: {KYC_LEVEL_CAPS[stepItem.level].dailyBuyToman > 0 ? formatToman(KYC_LEVEL_CAPS[stepItem.level].dailyBuyToman) : "بعد از سطح هویت"}
                  {" · "}
                  برداشت: {KYC_LEVEL_CAPS[stepItem.level].dailyWithdrawToman > 0 ? formatToman(KYC_LEVEL_CAPS[stepItem.level].dailyWithdrawToman) : "بعد از تطبیق حساب"}
                </p>
              </li>
            );
          })}
        </ol>
      </AppCard>
    </div>
  );
}
