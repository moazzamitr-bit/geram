"use client";

import { GoldIcon } from "@/components/ui/GoldIcon";
import { features } from "@/lib/data";
import { prefersReducedMotion } from "@/lib/motion";
import { useEffect, useRef } from "react";

export function FeatureGrid() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let ctx: { revert: () => void } | undefined;
    const run = async () => {
      if (!rootRef.current || prefersReducedMotion()) return;
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        gsap.fromTo(
          rootRef.current!.querySelectorAll("[data-feature]"),
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.08,
            ease: "power2.out",
            scrollTrigger: {
              trigger: rootRef.current,
              start: "top 78%",
            },
          }
        );
      }, rootRef);
    };
    void run();
    return () => ctx?.revert();
  }, []);

  return (
    <section
      id="features"
      ref={rootRef}
      className="relative scroll-mt-[84px] py-16 md:py-20"
      aria-label="امکانات"
    >
      <div className="container-site">
        <div className="max-w-xl">
          <p className="text-[12px] font-medium text-gold">چرا گرم</p>
          <h2 className="mt-2 text-[28px] font-extrabold leading-[1.45] text-text md:text-[34px]">
            از گرمی و مسچی کامل‌تر:
            <br />
            سه فلز، یک تجربه
          </h2>
          <p className="mt-3 text-[14px] leading-7 text-text-secondary md:text-[15px]">
            قیمت لایو، کارمزد شفاف، بدون اجرت — به‌همراه اهداف، خرید دوره‌ای و
            تحویل فیزیکی.
          </p>
        </div>

        <ul className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <li key={feature.id} data-feature className="group">
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-gold/[0.05] transition-shadow duration-250 group-hover:shadow-[0_0_24px_rgba(214,168,75,0.2)]">
                <GoldIcon name={feature.icon} size={20} />
              </span>
              <h3 className="text-[18px] font-bold text-text transition-colors group-hover:text-gold md:text-[19px]">
                {feature.title}
              </h3>
              <p className="mt-2 max-w-sm text-[13px] leading-7 text-text-secondary">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
