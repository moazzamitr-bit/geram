"use client";

import { GoldButton } from "@/components/ui/GoldButton";
import { prefersReducedMotion } from "@/lib/motion";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

export function HeroSection() {
  const rootRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const copyRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    let ctx: { revert: () => void } | undefined;
    let cleanupParallax: (() => void) | undefined;

    const run = async () => {
      const gsap = (await import("gsap")).default;
      if (!rootRef.current) return;
      const reduced = prefersReducedMotion();

      ctx = gsap.context(() => {
        if (reduced) {
          gsap.set(
            [...copyRefs.current.filter(Boolean), bgRef.current],
            { clearProps: "all", opacity: 1 }
          );
          return;
        }

        gsap.set(copyRefs.current.filter(Boolean), { opacity: 0, y: 28 });
        gsap.set(bgRef.current, { opacity: 0, scale: 1.05 });

        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.to(bgRef.current, { opacity: 1, scale: 1, duration: 1.4 }, 0).to(
          copyRefs.current.filter(Boolean),
          { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 },
          0.18
        );
      }, rootRef);

      const mq = window.matchMedia("(min-width: 1024px)");
      const onMove = (e: MouseEvent) => {
        if (!mq.matches || reduced || !bgRef.current) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        gsap.to(bgRef.current, {
          x: x * 14,
          y: y * 9,
          duration: 1,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      window.addEventListener("mousemove", onMove, { passive: true });
      cleanupParallax = () => window.removeEventListener("mousemove", onMove);
    };

    run();
    return () => {
      ctx?.revert();
      cleanupParallax?.();
    };
  }, []);

  return (
    <section
      id="home"
      ref={rootRef}
      className="relative isolate min-h-[100svh] overflow-hidden pt-[110px] lg:pt-[84px]"
      aria-label="بخش اصلی"
    >
      <div
        ref={bgRef}
        className="pointer-events-none absolute inset-0 -z-10 will-change-transform"
        aria-hidden
      >
        <Image
          src="/images/hero-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[72%_center]"
        />
        {/* Metal atmosphere: warm gold wash + cool silver edge + copper depth */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 78% 42%, rgba(214,168,75,0.22), transparent 42%),
              radial-gradient(ellipse at 88% 70%, rgba(184,115,51,0.18), transparent 38%),
              radial-gradient(ellipse at 60% 20%, rgba(192,199,209,0.12), transparent 35%)
            `,
          }}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            linear-gradient(
              to right,
              rgba(8, 11, 13, 0.92) 0%,
              rgba(8, 11, 13, 0.72) 26%,
              rgba(8, 11, 13, 0.28) 48%,
              transparent 64%
            )
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-44"
        style={{
          background: "linear-gradient(to top, #080B0D 0%, transparent 100%)",
        }}
      />

      <div className="container-site relative z-10 flex min-h-[calc(100svh-110px)] flex-col items-end justify-center pb-24 lg:min-h-[calc(100svh-84px)] lg:pb-28">
        <div className="w-full max-w-[560px] text-right">
          <p
            ref={(el) => {
              copyRefs.current[0] = el;
            }}
            className="font-[family-name:var(--font-vazirmatn)] text-[56px] font-extrabold leading-none tracking-tight text-gold-gradient md:text-[72px] xl:text-[84px]"
          >
            گرم
          </p>

          <h1
            ref={(el) => {
              copyRefs.current[1] = el;
            }}
            className="mt-5 text-[28px] font-bold leading-[1.55] text-text md:text-[36px] xl:text-[40px]"
          >
            طلا، نقره و مس
            <br />
            در یک کیف‌پول
          </h1>

          <p
            ref={(el) => {
              copyRefs.current[2] = el;
            }}
            className="mt-5 max-w-[440px] text-[15px] leading-8 text-text-secondary md:text-[16px]"
          >
            خرید و فروش لحظه‌ای با قیمت لایو، کارمزد شفاف و بدون اجرت ساخت.
          </p>

          <div
            ref={(el) => {
              copyRefs.current[3] = el;
            }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link href="/auth/login">
              <GoldButton className="min-w-[150px]" type="button">
                شروع معامله
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/15">
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </GoldButton>
            </Link>
            <Link
              href="#metals"
              className="inline-flex h-[52px] items-center rounded-[12px] border border-white/12 px-5 text-[14px] text-text-secondary transition-colors hover:border-gold/35 hover:text-text"
            >
              قیمت لایو فلزات
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
