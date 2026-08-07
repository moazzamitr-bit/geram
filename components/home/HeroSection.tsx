"use client";

import { GoldButton } from "@/components/ui/GoldButton";
import { GoldIcon } from "@/components/ui/GoldIcon";
import { heroTrustItems } from "@/lib/data";
import { prefersReducedMotion } from "@/lib/motion";
import { ArrowLeft, Play } from "lucide-react";
import Image from "next/image";
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

        gsap.set(copyRefs.current.filter(Boolean), { opacity: 0, y: 30 });
        gsap.set(bgRef.current, { opacity: 0, scale: 1.04 });

        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.to(bgRef.current, { opacity: 1, scale: 1, duration: 1.35 }, 0).to(
          copyRefs.current.filter(Boolean),
          { opacity: 1, y: 0, duration: 0.75, stagger: 0.08 },
          0.2
        );
      }, rootRef);

      const mq = window.matchMedia("(min-width: 1024px)");
      const onMove = (e: MouseEvent) => {
        if (!mq.matches || reduced || !bgRef.current) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        gsap.to(bgRef.current, {
          x: x * 12,
          y: y * 8,
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
      {/* FULL-BLEED hero background — exact photo, edge to edge */}
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
      </div>

      {/* Soft left scrim — text sits on the left, product stays clear on the right */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            linear-gradient(
              to right,
              rgba(8, 11, 13, 0.88) 0%,
              rgba(8, 11, 13, 0.62) 28%,
              rgba(8, 11, 13, 0.2) 48%,
              transparent 62%
            )
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40"
        style={{
          background: "linear-gradient(to top, #080B0D 0%, transparent 100%)",
        }}
      />

      <div className="container-site relative z-10 flex min-h-[calc(100svh-110px)] flex-col items-end justify-center pb-28 lg:min-h-[calc(100svh-84px)] lg:pb-32">
        <div className="w-full max-w-[520px] text-right">
          <h1
            ref={(el) => {
              copyRefs.current[0] = el;
            }}
            className="text-[42px] font-extrabold leading-[1.45] text-text md:text-[56px] xl:text-[68px]"
          >
            طلای واقعی،
            <br />
            به ساده‌ترین شکل
            <br />
            <span className="text-gold-gradient">برای همه</span>
          </h1>

          <p
            ref={(el) => {
              copyRefs.current[1] = el;
            }}
            className="mt-5 max-w-[480px] text-[15px] leading-8 text-text-secondary md:text-[16px]"
          >
            در گرم، با شفافیت کامل و پشتوانه واقعی طلا بخرید، پس‌انداز کنید و هر
            زمان که بخواهید به دارایی خود دسترسی داشته باشید.
          </p>

          <div
            ref={(el) => {
              copyRefs.current[2] = el;
            }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <GoldButton className="min-w-[140px]">
              شروع کنید
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/15">
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            </GoldButton>
            <button
              type="button"
              className="inline-flex items-center gap-2.5 text-[14px] text-text-secondary transition-colors hover:text-text"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 text-gold transition-all hover:bg-gold/10">
                <Play className="h-3.5 w-3.5 fill-current" />
              </span>
              تماشای ویدیو
            </button>
          </div>

          <ul
            ref={(el) => {
              copyRefs.current[3] = el;
            }}
            className="mt-12 flex flex-col gap-5 sm:flex-row sm:gap-8"
          >
            {heroTrustItems.map((item) => (
              <li key={item.title} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/25 bg-gold/[0.06] backdrop-blur-sm">
                  <GoldIcon name={item.icon} size={14} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-text">{item.title}</p>
                  <p className="mt-0.5 text-[11px] leading-5 text-text-muted">
                    {item.caption}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
