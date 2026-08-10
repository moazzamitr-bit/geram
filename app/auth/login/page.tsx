"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { GoldButton } from "@/components/ui/GoldButton";
import {
  DEMO_OTP,
  formatMaskedPhone,
  useAuth,
} from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Step = "phone" | "otp";

export default function LoginPage() {
  const { login, isAuthenticated, hydrated, user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("09121234567");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated) {
      router.replace(user?.onboardingDone ? "/app/dashboard" : "/auth/onboarding");
    }
  }, [hydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const canResend = seconds === 0;

  const normalizedPhone = useMemo(
    () => phone.replace(/\D/g, "").replace(/^98/, "0"),
    [phone]
  );

  const onSubmitPhone = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError("شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۱۲۳۴۵۶۷).");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
      setSeconds(60);
      setAttempts(0);
      setOtp("");
    }, 600);
  };

  const onSubmitOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (attempts >= 5) {
      setError("تعداد تلاش بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.");
      return;
    }
    if (otp.length !== 6) {
      setError("کد ۶ رقمی را کامل وارد کنید.");
      return;
    }
    setLoading(true);
    const result = await login(normalizedPhone, otp);
    setLoading(false);
    if (!result.ok) {
      setAttempts((a) => a + 1);
      setError(
        result.error === "invalid_otp"
          ? "کد تأیید نادرست است."
          : result.error === "supabase_not_configured"
            ? "اتصال به سرور آماده نیست. دوباره تلاش کنید یا حالت نمایشی را بدون کلید سوپابیس استفاده کنید."
            : /rate limit/i.test(result.error ?? "")
              ? "محدودیت ارسال ایمیل. چند دقیقه بعد دوباره تلاش کنید."
              : result.error?.includes("invalid")
                ? "ورود ناموفق بود. دوباره تلاش کنید."
                : result.error || "ورود ناموفق بود. دوباره تلاش کنید."
      );
      return;
    }
    router.replace("/auth/onboarding");
  };

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-bg px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 70% 30%, rgba(190,145,61,0.12), transparent 40%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 flex justify-center">
          <BrandLogo href="/" size="md" />
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-card-app p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-8">
          <div className="mb-2 inline-flex rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[11px] text-warning">
            حالت سندباکس
          </div>

          {step === "phone" ? (
            <form onSubmit={onSubmitPhone} className="space-y-5">
              <div>
                <h1 className="text-[22px] font-extrabold text-text">ورود / ثبت‌نام</h1>
                <p className="mt-2 text-[14px] leading-7 text-muted-app">
                  شماره موبایل خود را وارد کنید تا کد تأیید برایتان ارسال شود.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-[13px] text-text-secondary">
                  شماره موبایل
                </span>
                <input
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left text-[15px] text-text outline-none transition focus:border-gold"
                  placeholder="09121234567"
                />
              </label>

              {error && (
                <p className="text-[13px] text-negative" role="alert">
                  {error}
                </p>
              )}

              <GoldButton type="submit" className="w-full" disabled={loading}>
                {loading ? "لطفاً صبر کنید..." : "ادامه"}
              </GoldButton>
            </form>
          ) : (
            <form onSubmit={onSubmitOtp} className="space-y-5">
              <div>
                <h1 className="text-[22px] font-extrabold text-text">کد تأیید</h1>
                <p className="mt-2 text-[14px] leading-7 text-muted-app">
                  کد تأیید به شماره {formatMaskedPhone(normalizedPhone)} ارسال شد.
                </p>
                <p className="mt-2 text-[12px] text-warning">
                  در سندباکس کد ثابت است: {DEMO_OTP}
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-[13px] text-text-secondary">
                  کد ۶ رقمی
                </span>
                <input
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-center text-[22px] tracking-[0.4em] text-text outline-none transition focus:border-gold"
                  placeholder="------"
                />
              </label>

              {error && (
                <p className="text-[13px] text-negative" role="alert">
                  {error}
                </p>
              )}

              <GoldButton type="submit" className="w-full" disabled={loading}>
                {loading ? "در حال بررسی..." : "تأیید و ورود"}
              </GoldButton>

              <div className="flex items-center justify-between text-[13px]">
                <button
                  type="button"
                  className="text-text-secondary hover:text-gold"
                  onClick={() => {
                    setStep("phone");
                    setError("");
                    setOtp("");
                  }}
                >
                  ویرایش شماره
                </button>
                <button
                  type="button"
                  disabled={!canResend}
                  className={cn(
                    "text-text-secondary",
                    canResend ? "hover:text-gold" : "opacity-50"
                  )}
                  onClick={() => {
                    if (!canResend) return;
                    setSeconds(60);
                    setError("");
                  }}
                >
                  {canResend ? "ارسال مجدد" : `ارسال مجدد (${seconds})`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
