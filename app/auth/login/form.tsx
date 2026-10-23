"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { GoldButton } from "@/components/ui/GoldButton";
import { DEMO_OTP, formatMaskedPhone, useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Method = "password" | "otp";
type OtpStep = "phone" | "otp";

const fieldClass =
  "h-12 w-full rounded-xl border border-black/10 bg-[#F6F4F1] px-4 text-[15px] text-text outline-none transition focus:border-[#FFB800] focus:bg-white";

function messageFor(code: string | null) {
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
    case "timeout":
      return "ورود بیش از حد طول کشید. اتصال را بررسی کنید و دوباره تلاش کنید.";
    case "network":
      return "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
    case "service_unavailable":
    case "supabase_not_configured":
    case "sign_in_failed":
      return "ورود موقتاً در دسترس نیست.";
    default:
      return code ? "عملیات ناموفق بود. دوباره تلاش کنید." : "";
  }
}

export function UserLoginForm({
  initialError = "",
  initialTab = "login",
}: {
  initialError?: string;
  initialTab?: "login" | "register";
}) {
  const { isAuthenticated, hydrated, user } = useAuth();
  const [method, setMethod] = useState<Method>("password");
  const [queryError, setQueryError] = useState(messageFor(initialError || null));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    if (code) setQueryError(messageFor(code));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3_000);
    fetch("/api/auth/config", { cache: "no-store", signal: controller.signal })
      .then((res) => res.json())
      .then((data: { method?: string }) => {
        if (data.method === "otp") setMethod("otp");
      })
      .catch(() => {
        /* password form is already on screen */
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;
    window.location.replace(user.onboardingDone ? "/app/dashboard" : "/auth/onboarding");
  }, [hydrated, isAuthenticated, user]);

  return (
    <div className="geram-app min-h-svh bg-bg text-text">
      <div
        dir="ltr"
        className="mx-auto grid min-h-svh max-w-6xl items-stretch gap-4 px-4 py-6 lg:grid-cols-2 lg:px-8 lg:py-10"
      >
        <div dir="rtl" className="order-1 flex items-center justify-center lg:order-2">
          <div className="w-full max-w-[440px] rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_24px_70px_rgba(28,25,23,0.06)] md:p-8">
            <div className="mb-6 flex justify-center lg:justify-start">
              <BrandLogo href="/" size="md" />
            </div>
            {queryError && (
              <p className="mb-4 text-[13px] text-negative" role="alert">
                {queryError}
              </p>
            )}
            {method === "otp" ? <OtpLogin /> : <PasswordLogin initialTab={initialTab} />}
          </div>
        </div>
        <aside
          dir="rtl"
          className="relative order-2 hidden overflow-hidden rounded-[28px] bg-[#FBF4E4] lg:order-1 lg:flex lg:flex-col lg:justify-between lg:p-10"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 40%, rgba(255,184,0,0.28), transparent 46%)",
            }}
          />
          <BrandLogo href="/" size="md" className="relative" />
          <div className="relative max-w-sm">
            <p className="text-[28px] font-extrabold leading-10 text-text">
              طلا، نقره و مس در یک حساب
            </p>
            <p className="mt-4 text-[15px] leading-8 text-text-secondary">
              قیمت لحظه‌ای و کارمزد را قبل از تأیید می‌بینید. موجودی فقط از دفترکل گرم تغییر می‌کند.
            </p>
          </div>
          <p className="relative text-[13px] text-muted-app">geram.co</p>
        </aside>
      </div>
    </div>
  );
}

function PasswordLogin({ initialTab }: { initialTab: "login" | "register" }) {
  const { loginWithPassword, register } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"login" | "register" | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "");
    const password = String(form.get("password") ?? "");
    setError("");
    if (!/^09\d{9}$/.test(phone.replace(/\D/g, "").replace(/^98/, "0"))) {
      setError(messageFor("invalid_phone"));
      return;
    }
    setLoading("login");
    try {
      const result = await loginWithPassword(phone, password);
      if (!result.ok) {
        setError(messageFor(result.error ?? "invalid_credentials"));
        return;
      }
      window.location.assign(result.onboardingDone ? "/app/dashboard" : "/auth/onboarding");
    } finally {
      setLoading(null);
    }
  };

  const onRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "");
    const password = String(form.get("password") ?? "");
    const passwordConfirm = String(form.get("passwordConfirm") ?? "");
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    setError("");
    if (!firstName || !lastName) {
      setError(messageFor("invalid_input"));
      return;
    }
    if (password.length < 8) {
      setError("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }
    setLoading("register");
    try {
      const result = await register({ phone, password, firstName, lastName });
      if (!result.ok) {
        setError(messageFor(result.error ?? "invalid_input"));
        return;
      }
      window.location.assign("/auth/onboarding");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="auth-switch">
      <input
        id="auth-tab-login"
        name="auth-tab"
        type="radio"
        defaultChecked={initialTab !== "register"}
        className="sr-only"
        onChange={() => setError("")}
      />
      <input
        id="auth-tab-register"
        name="auth-tab"
        type="radio"
        defaultChecked={initialTab === "register"}
        className="sr-only"
        onChange={() => setError("")}
      />
      <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/[0.07] p-1 text-[14px]">
        <label
          htmlFor="auth-tab-login"
          className="flex h-10 cursor-pointer items-center justify-center rounded-lg text-muted-app"
        >
          ورود
        </label>
        <label
          htmlFor="auth-tab-register"
          className="flex h-10 cursor-pointer items-center justify-center rounded-lg text-muted-app"
        >
          ثبت‌نام
        </label>
      </div>

      <form
        action="/api/auth/password-login"
        method="POST"
        onSubmit={onLogin}
        className="auth-pane-login space-y-4"
      >
        <div>
          <h1 className="text-[22px] font-extrabold text-text">ورود به حساب کاربری</h1>
          <p className="mt-2 text-[14px] leading-7 text-muted-app">
            برای مدیریت دارایی‌ها، شماره موبایل و رمز عبور را وارد کنید.
          </p>
        </div>
        <PhoneField />
        <PasswordField show={showPassword} onToggle={() => setShowPassword((v) => !v)} autoComplete="current-password" minLength={1} />
        {error && (
          <p className="text-[13px] text-negative" role="alert">
            {error}
          </p>
        )}
        <GoldButton type="submit" variant="black" className="w-full" disabled={loading !== null}>
          {loading === "login" ? "در حال ورود..." : "ورود"}
        </GoldButton>
      </form>

      <form
        action="/api/auth/register"
        method="POST"
        onSubmit={onRegister}
        className="auth-pane-register space-y-4"
      >
        <div>
          <h1 className="text-[22px] font-extrabold text-text">ثبت‌نام</h1>
          <p className="mt-2 text-[14px] leading-7 text-muted-app">
            شماره موبایل و یک رمز عبور حداقل ۸ کاراکتری انتخاب کنید.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-[13px] text-text-secondary">نام</span>
            <input name="firstName" autoComplete="given-name" required className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] text-text-secondary">نام خانوادگی</span>
            <input name="lastName" autoComplete="family-name" required className={fieldClass} />
          </label>
        </div>
        <PhoneField />
        <PasswordField
          show={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
          autoComplete="new-password"
          minLength={8}
        />
        <label className="block">
          <span className="mb-2 block text-[13px] text-text-secondary">تکرار رمز عبور</span>
          <input
            name="passwordConfirm"
            dir="ltr"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            required
            className={cn(fieldClass, "text-left")}
          />
          <span className="mt-2 block text-[12px] text-muted-app">حداقل ۸ کاراکتر</span>
        </label>
        {error && (
          <p className="text-[13px] text-negative" role="alert">
            {error}
          </p>
        )}
        <GoldButton type="submit" variant="black" className="w-full" disabled={loading !== null}>
          {loading === "register" ? "لطفاً صبر کنید..." : "ثبت‌نام و ورود"}
        </GoldButton>
      </form>
    </div>
  );
}

function PhoneField() {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] text-text-secondary">شماره موبایل</span>
      <input
        name="phone"
        dir="ltr"
        inputMode="numeric"
        autoComplete="tel"
        required
        placeholder="09121234567"
        className={cn(fieldClass, "text-left")}
      />
    </label>
  );
}

function PasswordField({
  show,
  onToggle,
  autoComplete,
  minLength = 8,
}: {
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-[13px] text-text-secondary">
        رمز عبور
        <button type="button" onClick={onToggle} className="text-[12px] text-muted-app hover:text-gold">
          {show ? "پنهان کردن" : "نمایش"}
        </button>
      </span>
      <input
        name="password"
        dir="ltr"
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        className={cn(fieldClass, "text-left")}
      />
    </label>
  );
}

function OtpLogin() {
  const { login, isAuthenticated, hydrated, user } = useAuth();
  const [step, setStep] = useState<OtpStep>("phone");
  const [phone, setPhone] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    window.location.replace(user?.onboardingDone ? "/app/dashboard" : "/auth/onboarding");
  }, [hydrated, isAuthenticated, user]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const normalizedPhone = useMemo(() => phone.replace(/\D/g, "").replace(/^98/, "0"), [phone]);

  const sendCode = async () => {
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
        signal: AbortSignal.timeout(12_000),
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
            : "ارسال پیامک ناموفق بود. دوباره تلاش کنید."
        );
        return false;
      }
      setSandbox(Boolean(data.sandbox));
      setSeconds(data.resendInSec ?? 60);
      return true;
    } catch {
      setError(messageFor("network"));
      return false;
    }
  };

  return step === "phone" ? (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        if (!/^09\d{9}$/.test(normalizedPhone)) {
          setError(messageFor("invalid_phone"));
          return;
        }
        setLoading(true);
        const sent = await sendCode();
        setLoading(false);
        if (sent) setStep("otp");
      }}
    >
      <div>
        <h1 className="text-[22px] font-extrabold text-text">ورود / ثبت‌نام</h1>
        <p className="mt-2 text-[14px] leading-7 text-muted-app">
          شماره موبایل خود را وارد کنید تا کد تأیید برایتان ارسال شود.
        </p>
      </div>
      <label className="block">
        <span className="mb-2 block text-[13px] text-text-secondary">شماره موبایل</span>
        <input
          dir="ltr"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="09121234567"
          className={cn(fieldClass, "text-left")}
        />
      </label>
      {error && (
        <p className="text-[13px] text-negative" role="alert">
          {error}
        </p>
      )}
      <GoldButton type="submit" variant="black" className="w-full" disabled={loading}>
        {loading ? "لطفاً صبر کنید..." : "ادامه"}
      </GoldButton>
    </form>
  ) : (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        if (otp.length !== 6) {
          setError("کد ۶ رقمی را کامل وارد کنید.");
          return;
        }
        setLoading(true);
        const result = await login(normalizedPhone, otp);
        setLoading(false);
        if (!result.ok) {
          setError(result.error === "invalid_otp" ? "کد تأیید نادرست است." : messageFor(result.error ?? ""));
          return;
        }
        window.location.assign("/auth/onboarding");
      }}
    >
      <div>
        <h1 className="text-[22px] font-extrabold text-text">کد تأیید</h1>
        <p className="mt-2 text-[14px] leading-7 text-muted-app">
          کد تأیید به شماره {formatMaskedPhone(normalizedPhone)} ارسال شد.
        </p>
        {sandbox && <p className="mt-2 text-[12px] text-warning">در سندباکس کد ثابت است: {DEMO_OTP}</p>}
      </div>
      <label className="block">
        <span className="mb-2 block text-[13px] text-text-secondary">کد ۶ رقمی</span>
        <input
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-12 w-full rounded-xl border border-black/10 bg-[#F6F4F1] px-4 text-center text-[22px] tracking-[0.4em] text-text outline-none transition focus:border-[#FFB800] focus:bg-white"
        />
      </label>
      {error && (
        <p className="text-[13px] text-negative" role="alert">
          {error}
        </p>
      )}
      <GoldButton type="submit" variant="black" className="w-full" disabled={loading}>
        {loading ? "در حال بررسی..." : "تأیید و ورود"}
      </GoldButton>
      <button
        type="button"
        className="text-[13px] text-text-secondary hover:text-gold"
        onClick={() => {
          setStep("phone");
          setError("");
        }}
      >
        ویرایش شماره
      </button>
    </form>
  );
}
