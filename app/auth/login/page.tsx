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
  // The server decides the flow (AUTH_METHOD); password is the default.
  const [method, setMethod] = useState<"password" | "otp" | null>(null);

  useEffect(() => {
    fetch("/api/auth/config", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ method?: "password" | "otp" }>)
      .then((d) => setMethod(d.method === "otp" ? "otp" : "password"))
      .catch(() => setMethod("password"));
  }, []);

  if (method === null) {
    return <div className="min-h-svh bg-bg" aria-busy="true" />;
  }
  return method === "otp" ? <OtpLogin /> : <PasswordLogin />;
}

const fieldClass =
  "h-12 w-full rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-[15px] text-text outline-none transition focus:border-gold";

function PasswordLogin() {
  const { loginWithPassword, register, isAuthenticated, hydrated, user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated) {
      router.replace(user?.onboardingDone ? "/app/dashboard" : "/auth/onboarding");
    }
  }, [hydrated, isAuthenticated, user, router]);

  const normalizedPhone = phone.replace(/\D/g, "").replace(/^98/, "0");

  const messageFor = (code?: string) => {
    switch (code) {
      case "invalid_credentials":
        return "شماره موبایل یا رمز عبور نادرست است.";
      case "already_registered":
        return "این شماره قبلاً ثبت‌نام کرده است. از بخش «ورود» وارد شوید.";
      case "invalid_phone":
        return "شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۱۲۳۴۵۶۷).";
      case "invalid_input":
        return "لطفاً همه فیلدها را درست پر کنید.";
      case "rate_limited":
        return "تعداد تلاش‌ها زیاد است. چند دقیقه بعد دوباره تلاش کنید.";
      case "service_unavailable":
      case "supabase_not_configured":
        return "ثبت‌نام موقتاً در دسترس نیست.";
      default:
        return "عملیات ناموفق بود. دوباره تلاش کنید.";
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError(messageFor("invalid_phone"));
      return;
    }
    if (password.length < 8) {
      setError("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (tab === "register") {
      if (!firstName.trim() || !lastName.trim()) {
        setError("نام و نام خانوادگی را وارد کنید.");
        return;
      }
      if (password !== password2) {
        setError("رمز عبور و تکرار آن یکسان نیستند.");
        return;
      }
    }
    setLoading(true);
    const result =
      tab === "login"
        ? await loginWithPassword(normalizedPhone, password)
        : await register({
            phone: normalizedPhone,
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          });
    setLoading(false);
    if (!result.ok) {
      setError(messageFor(result.error));
      return;
    }
    router.replace(tab === "register" ? "/auth/onboarding" : "/app/dashboard");
  };

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-bg px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at 70% 30%, rgba(190,145,61,0.12), transparent 40%)",
        }}
      />
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 flex justify-center">
          <BrandLogo href="/" size="md" />
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-card-app p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/[0.07] p-1 text-[14px]">
            {(
              [
                ["login", "ورود"],
                ["register", "ثبت‌نام"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  setError("");
                }}
                className={cn(
                  "h-10 rounded-lg transition-colors",
                  tab === key ? "bg-gold/15 font-bold text-gold" : "text-muted-app hover:text-text"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {tab === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-2 block text-[13px] text-text-secondary">نام</span>
                  <input
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[13px] text-text-secondary">نام خانوادگی</span>
                  <input
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-[13px] text-text-secondary">شماره موبایل</span>
              <input
                dir="ltr"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09121234567"
                className={cn(fieldClass, "text-left")}
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center justify-between text-[13px] text-text-secondary">
                رمز عبور
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[12px] text-muted-app hover:text-gold"
                >
                  {showPassword ? "پنهان کردن" : "نمایش"}
                </button>
              </span>
              <input
                dir="ltr"
                type={showPassword ? "text" : "password"}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(fieldClass, "text-left")}
              />
            </label>

            {tab === "register" && (
              <label className="block">
                <span className="mb-2 block text-[13px] text-text-secondary">تکرار رمز عبور</span>
                <input
                  dir="ltr"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className={cn(fieldClass, "text-left")}
                />
                <span className="mt-2 block text-[12px] text-muted-app">حداقل ۸ کاراکتر</span>
              </label>
            )}

            {error && (
              <p className="text-[13px] text-negative" role="alert">
                {error}
              </p>
            )}

            <GoldButton type="submit" className="w-full" disabled={loading}>
              {loading ? "لطفاً صبر کنید..." : tab === "login" ? "ورود" : "ثبت‌نام و ورود"}
            </GoldButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function OtpLogin() {
  const { login, isAuthenticated, hydrated, user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [sandbox, setSandbox] = useState(false);
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

  const sendCode = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        sandbox?: boolean;
        resendInSec?: number;
        retryAfterSec?: number;
      };
      if (!data.ok) {
        setError(
          data.error === "cooldown" || data.error === "too_many"
            ? `برای ارسال دوباره ${(data.retryAfterSec ?? 60).toLocaleString("fa-IR")} ثانیه صبر کنید.`
            : data.error === "unavailable"
              ? "ورود موقتاً در دسترس نیست."
              : "ارسال پیامک ناموفق بود. دوباره تلاش کنید."
        );
        return false;
      }
      setSandbox(Boolean(data.sandbox));
      setSeconds(data.resendInSec ?? 60);
      return true;
    } catch {
      // Offline demo (no server auth): the local sandbox flow still works.
      setSandbox(true);
      setSeconds(60);
      return true;
    }
  };

  const onSubmitPhone = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError("شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۱۲۳۴۵۶۷).");
      return;
    }
    setLoading(true);
    const sent = await sendCode();
    setLoading(false);
    if (!sent) return;
    setStep("otp");
    setAttempts(0);
    setOtp("");
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
          : result.error === "expired"
            ? "کد منقضی شده است. کد جدید بگیرید."
            : result.error === "too_many_attempts" || result.error === "rate_limited"
              ? "تعداد تلاش بیش از حد مجاز است. کمی بعد دوباره تلاش کنید."
              : result.error === "otp_provider_not_configured"
                ? "ورود موقتاً در دسترس نیست."
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
          {sandbox && (
            <div className="mb-2 inline-flex rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[11px] text-warning">
              حالت سندباکس
            </div>
          )}

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
                {sandbox && (
                  <p className="mt-2 text-[12px] text-warning">
                    در سندباکس کد ثابت است: {DEMO_OTP}
                  </p>
                )}
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
                    setError("");
                    void sendCode();
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
