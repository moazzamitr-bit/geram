"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { GoldButton } from "@/components/ui/GoldButton";
import { FormEvent, useEffect, useState } from "react";

const ERRORS: Record<string, string> = {
  invalid_credentials: "ایمیل یا رمز عبور اشتباه است.",
  invalid_input: "ایمیل و رمز عبور را وارد کنید.",
  not_admin: "این حساب دسترسی ادمین ندارد.",
  supabase_not_configured: "سوپابیس پیکربندی نشده. NEXT_PUBLIC_SUPABASE_URL و ANON_KEY را تنظیم کنید.",
  timeout: "ورود بیش از حد طول کشید. دوباره تلاش کنید.",
  network: "ارتباط با سرور برقرار نشد.",
  service_unavailable: "ورود موقتاً در دسترس نیست.",
  rate_limited: "تعداد تلاش‌ها زیاد است. چند دقیقه بعد دوباره تلاش کنید.",
};

function errorText(code: string | null) {
  if (!code) return "";
  return ERRORS[code] ?? "ورود ناموفق بود. دوباره تلاش کنید.";
}

export function AdminLoginForm({ initialError = "" }: { initialError?: string }) {
  const [error, setError] = useState(errorText(initialError || null));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(errorText(code));
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setError("");
    if (!email || !password) {
      setError(errorText("invalid_input"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(12_000),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(errorText(data.error ?? "invalid_credentials"));
        return;
      }
      window.location.assign("/admin");
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      setError(errorText(timedOut ? "timeout" : "network"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#070B12] px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0F1724] p-7">
        <BrandLogo href="/" size="md" showWordmark />
        <h1 className="mt-6 text-[24px] font-extrabold text-white">ورود ادمین</h1>
        <p className="mt-2 text-[13px] leading-7 text-white/65">
          فقط حساب‌هایی با نقش admin در جدول profiles وارد می‌شوند.
        </p>
        <form action="/api/auth/admin-login" method="POST" onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-[13px]">
            <span className="text-white/65">ایمیل</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="moazzamitr@gmail.com"
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#070B12] px-3 text-white outline-none focus:border-gold"
            />
          </label>
          <label className="block text-[13px]">
            <span className="text-white/65">رمز عبور</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#070B12] px-3 text-white outline-none focus:border-gold"
            />
          </label>
          <p className="text-[12px] leading-6 text-white/45">
            admin@geram.ir روی این سرور ادمین نیست. از moazzamitr@gmail.com استفاده کنید.
          </p>
          {error && (
            <p className="text-[13px] text-negative" role="alert">
              {error}
            </p>
          )}
          <GoldButton type="submit" className="w-full" disabled={loading}>
            {loading ? "در حال ورود..." : "ورود به پنل"}
          </GoldButton>
        </form>
      </div>
    </div>
  );
}
