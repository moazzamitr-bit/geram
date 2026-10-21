"use client";

import { PhoneMockup } from "@/components/ui/PhoneMockup";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { prefersReducedMotion } from "@/lib/motion";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

export function AppShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const phoneFrontRef = useRef<HTMLDivElement>(null);
  const phoneBackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ctx: { revert: () => void } | undefined;

    const run = async () => {
      if (!sectionRef.current) return;
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (prefersReducedMotion()) return;

      ctx = gsap.context(() => {
        gsap.fromTo(
          textRef.current,
          { opacity: 0, x: 40 },
          {
            opacity: 1,
            x: 0,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 75%",
              end: "top 35%",
              scrub: 0.6,
            },
          }
        );

        gsap.fromTo(
          phoneFrontRef.current,
          { y: 80 },
          {
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              end: "top 30%",
              scrub: 0.6,
            },
          }
        );

        gsap.fromTo(
          phoneBackRef.current,
          { y: 140 },
          {
            y: 15,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              end: "top 30%",
              scrub: 0.6,
            },
          }
        );
      }, sectionRef);
    };

    run();
    return () => ctx?.revert();
  }, []);

  return (
    <section
      id="price"
      ref={sectionRef}
      className="relative overflow-hidden py-16 md:py-24 scroll-mt-[84px]"
      aria-label="اپلیکیشن گرم"
    >
      <div id="app" className="absolute -top-[84px]" aria-hidden />
      <div id="guide" className="sr-only" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 18% 50%, rgba(190,145,61,0.1), transparent 40%)",
        }}
      />

      <div className="container-site grid items-center gap-14 lg:grid-cols-2 lg:gap-10">
        {/* Phones — LEFT in RTL (first column = right visually... wait)
            Spec: LEFT = phones, RIGHT = text
            In RTL grid: first column is RIGHT side.
            So first = text, second = phones.
            Mobile: text first, phones second.
        */}
        <div ref={textRef} className="order-1 max-w-xl lg:mr-auto">
          <SectionLabel icon={<Sparkles size={14} className="text-gold" />}>
            تجربه‌ای متفاوت
          </SectionLabel>

          <h2 className="mt-4 text-[36px] font-extrabold leading-[1.45] text-text md:text-[44px] xl:text-[50px]">
            بازار سه فلز
            <br />
            در جیب شما
          </h2>

          <p className="mt-5 max-w-md text-[15px] leading-8 text-text-secondary md:text-[16px]">
            قیمت لایو طلا، نقره و مس، نمودار حرفه‌ای، کارمزد شفاف و پرتفوی یکپارچه
            — برای تصمیم‌گیری سریع و مطمئن.
          </p>

          {/* Store buttons return once the app is actually published on Bazaar/Myket. */}
          <p className="mt-8 max-w-md rounded-2xl border border-white/[0.07] bg-card px-4 py-3 text-[13px] leading-7 text-text-secondary">
            نسخه وب گرم روی گوشی مثل اپلیکیشن نصب می‌شود: در مرورگر گزینه «افزودن به صفحه اصلی» را بزنید.
          </p>

          <Link
            href="/auth/login"
            className="link-underline mt-5 inline-block text-[13px] text-gold"
          >
            ورود به نسخه وب
          </Link>
        </div>

        <div className="order-2 relative mx-auto flex h-[460px] w-full max-w-[420px] items-center justify-center sm:h-[520px] lg:mx-0 lg:max-w-none">
          <div
            ref={phoneBackRef}
            className="absolute left-[8%] top-[8%] w-[46%] max-w-[220px] sm:left-[12%]"
            style={{ transform: "rotate(-6deg)" }}
          >
            <PhoneMockup screen="buy" className="max-w-none opacity-90" />
          </div>
          <div
            ref={phoneFrontRef}
            className="absolute right-[6%] top-[2%] z-10 w-[52%] max-w-[250px] sm:right-[10%]"
            style={{ transform: "rotate(4deg)" }}
          >
            <PhoneMockup screen="market" className="max-w-none" />
          </div>
        </div>
      </div>
    </section>
  );
}
