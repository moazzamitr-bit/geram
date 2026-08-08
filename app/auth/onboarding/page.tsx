"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { GoldButton } from "@/components/ui/GoldButton";
import { useAuth } from "@/lib/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const slides = [
  {
    title: "خوش آمدید به گرم",
    body: "خرید و نگهداری طلای واقعی، ساده‌تر و شفاف‌تر از همیشه.",
  },
  {
    title: "اعتماد و شفافیت",
    body: "موجودی طلای شما همیشه قابل رهگیری است.",
  },
  {
    title: "پس‌انداز هدفمند",
    body: "برای هدف‌های مالی خود با طلا پس‌انداز کنید.",
  },
] as const;

export default function OnboardingPage() {
  const { user, hydrated, isAuthenticated, completeOnboarding } = useAuth();
  const router = useRouter();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace("/auth/login");
      return;
    }
    if (user?.onboardingDone) {
      router.replace("/app/dashboard");
    }
  }, [hydrated, isAuthenticated, user, router]);

  const isLast = index === slides.length - 1;
  const slide = slides[index];

  const finish = async () => {
    await completeOnboarding();
    router.replace("/app/dashboard");
  };

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bg text-muted-app">
        در حال آماده‌سازی...
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-bg px-5 py-8">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="flex items-center justify-between">
          <BrandLogo href="/" size="sm" />
          <button
            type="button"
            onClick={finish}
            className="text-[13px] text-muted-app hover:text-gold"
          >
            رد کردن
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center py-12">
          <p className="text-[13px] text-gold">
            {index + 1} از {slides.length}
          </p>
          <h1 className="mt-3 text-[32px] font-extrabold leading-[1.45] text-text">
            {slide.title}
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-8 text-muted-app">
            {slide.body}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= index ? "bg-gold" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          {index > 0 && (
            <GoldButton
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIndex((i) => i - 1)}
            >
              قبلی
            </GoldButton>
          )}
          <GoldButton
            type="button"
            className="flex-1"
            onClick={() => {
              if (isLast) finish();
              else setIndex((i) => i + 1);
            }}
          >
            {isLast ? "شروع احراز هویت" : "ادامه"}
          </GoldButton>
        </div>
        {isLast && (
          <button
            type="button"
            onClick={finish}
            className="mt-3 text-center text-[13px] text-muted-app hover:text-gold"
          >
            فعلاً بعداً احراز می‌کنم
          </button>
        )}
      </div>
    </div>
  );
}
