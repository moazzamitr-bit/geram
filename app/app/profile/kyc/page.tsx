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
import { KYC_MESSAGES, type KycErrorCode } from "@/lib/kyc/messages";
import { FormEvent, useState } from "react";

const fieldClass =
  "h-12 w-full rounded-xl border border-black/10 bg-[#F6F4F1] px-4 text-[15px] text-text outline-none transition focus:border-[#FFB800] focus:bg-white";

const levels: { status: KycStatus; title: string; desc: string }[] = [
  {
    status: "UNVERIFIED",
    title: "ثبت نشده",
    desc: "کد ملی هنوز با شماره موبایل این حساب تطبیق نشده است.",
  },
  {
    status: "PENDING",
    title: "در حال بررسی",
    desc: "درخواست ثبت شده و منتظر نتیجه است.",
  },
  {
    status: "VERIFIED",
    title: "تأییدشده",
    desc: "شماره موبایل با کد ملی مطابقت دارد و نام از ثبت احوال خوانده شده است.",
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
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

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
        description="شماره موبایل همین حساب با کد ملی شما در شاهکار تطبیق می‌شود و نام از ثبت احوال خوانده می‌شود."
        backHref="/app/profile"
      />

      <AppCard>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">وضعیت فعلی</h2>
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

      {status === "VERIFIED" && info && (
        <p className="text-[13px] text-text-secondary">{info}</p>
      )}

      <AppCard>
        <h2 className="text-[15px] font-bold">معنی وضعیت‌ها</h2>
        <ul className="mt-4 space-y-3">
          {levels.map((level) => (
            <li
              key={level.status}
              className={`rounded-xl border px-3 py-3 ${
                status === level.status ? "border-gold/35 bg-gold/5" : "border-black/[0.06]"
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
