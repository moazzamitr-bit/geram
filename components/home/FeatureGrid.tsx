"use client";

import { GoldIcon } from "@/components/ui/GoldIcon";
import { features } from "@/lib/data";
import { cn } from "@/lib/utils";
import { ArrowUpLeft } from "lucide-react";

export function FeatureGrid() {
  return (
    <section
      id="features"
      className="relative z-20 -mt-[60px] pb-6"
      aria-label="امکانات"
    >
      <div className="container-site">
        <div className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-card-elevated shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <ul className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none lg:grid lg:grid-cols-5 lg:overflow-visible">
            {features.map((feature, i) => (
              <FeatureItem
                key={feature.id}
                feature={feature}
                className={cn(
                  "min-w-[78%] snap-center border-l border-white/[0.06] sm:min-w-[46%] lg:min-w-0",
                  i === features.length - 1 && "border-l-0 lg:border-l-0"
                )}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FeatureItem({
  feature,
  className,
}: {
  feature: (typeof features)[number];
  className?: string;
}) {
  return (
    <li
      className={cn(
        "group relative flex flex-col px-6 py-8 transition-all duration-250",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-250 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(214,168,75,0.08), transparent 65%)",
        }}
      />

      <span className="relative mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-gold/[0.05] transition-shadow duration-250 group-hover:shadow-[0_0_24px_rgba(214,168,75,0.25)]">
        <GoldIcon
          name={feature.icon}
          size={20}
          className="transition-transform duration-250 group-hover:scale-105"
        />
      </span>

      <h3 className="relative text-[18px] font-bold text-text transition-colors duration-250 group-hover:text-gold md:text-[20px]">
        {feature.title}
      </h3>
      <p className="relative mt-3 flex-1 text-[13px] leading-7 text-text-secondary">
        {feature.description}
      </p>

      <button
        type="button"
        aria-label={`جزئیات ${feature.title}`}
        className="relative mt-6 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] text-text-secondary transition-all duration-250 group-hover:border-gold/35 group-hover:text-gold group-hover:-translate-x-1"
      >
        <ArrowUpLeft size={15} strokeWidth={1.75} />
      </button>
    </li>
  );
}
