"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { GoldButton } from "@/components/ui/GoldButton";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@geram.ir");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!hasSupabaseEnv()) {
      setError("سوپابیس پیکربندی نشده. NEXT_PUBLIC_SUPABASE_URL و ANON_KEY را تنظیم کنید.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) {
        setError(signError.message);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .single();
      if (profile?.role !== "admin") {
        await supabase.auth.signOut();
        setError("این حساب دسترسی ادمین ندارد.");
        setLoading(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ورود");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#070B12] px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0F1724] p-7">
        <BrandLogo href="/" size="md" />
        <h1 className="mt-6 text-[24px] font-extrabold text-white">ورود ادمین</h1>
        <p className="mt-2 text-[13px] leading-7 text-white/50">
          فقط حساب‌هایی با نقش admin در جدول profiles وارد می‌شوند.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-[13px]">
            <span className="text-white/50">ایمیل</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#070B12] px-3 outline-none focus:border-gold"
            />
          </label>
          <label className="block text-[13px]">
            <span className="text-white/50">رمز عبور</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#070B12] px-3 outline-none focus:border-gold"
            />
          </label>
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
