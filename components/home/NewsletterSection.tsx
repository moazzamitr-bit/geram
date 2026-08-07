"use client";

import { GoldButton } from "@/components/ui/GoldButton";
import { Mail } from "lucide-react";
import { FormEvent, useState } from "react";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "done">("idle");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("done");
    setEmail("");
  };

  return (
    <section className="pb-16 md:pb-24" aria-label="خبرنامه">
      <div className="container-site">
        <div className="flex min-h-[130px] flex-col items-stretch justify-between gap-6 rounded-[18px] border border-white/[0.07] bg-card-elevated px-6 py-7 shadow-[0_20px_60px_rgba(0,0,0,0.3)] md:flex-row md:items-center md:px-10">
          <div className="flex items-start gap-4 md:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold/30 bg-gold/[0.08]">
              <Mail className="h-5 w-5 text-gold" strokeWidth={1.5} />
            </span>
            <div>
              <h2 className="text-[20px] font-bold text-text md:text-[22px]">
                از جدیدترین‌ها باخبر شوید
              </h2>
              <p className="mt-1 max-w-md text-[13px] leading-6 text-text-secondary">
                اخبار، به‌روزرسانی‌ها و تحلیل‌های بازار طلا را در ایمیل خود دریافت
                کنید.
              </p>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-center"
          >
            <label className="sr-only" htmlFor="newsletter-email">
              ایمیل
            </label>
            <input
              id="newsletter-email"
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="h-[52px] w-full flex-1 rounded-xl border border-white/10 bg-[#0A0C0E] px-4 text-left text-[14px] text-text placeholder:text-text-muted transition-colors focus:border-gold focus:outline-none"
            />
            <GoldButton type="submit" className="min-w-[110px] shrink-0">
              عضویت
            </GoldButton>
          </form>
        </div>

        {status === "done" && (
          <p className="mt-3 text-center text-[13px] text-positive" role="status">
            عضویت شما با موفقیت ثبت شد.
          </p>
        )}
      </div>
    </section>
  );
}
