"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import type { PriceChartProps } from "@/components/ui/PriceChart";

/**
 * Recharts stays out of the first script wave. The chart module is fetched
 * once this placeholder is near the viewport, which is immediate on the
 * trade and dashboard screens and only after scroll on the marketing mockups.
 */
export function DeferredPriceChart(props: PriceChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [Chart, setChart] = useState<ComponentType<PriceChartProps> | null>(null);
  const height = props.height ?? 88;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let cancelled = false;

    const start = () => {
      void import("@/components/ui/PriceChart").then((mod) => {
        if (!cancelled) setChart(() => mod.PriceChart);
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      start();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        start();
      },
      { rootMargin: "320px 0px" }
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={hostRef} className="w-full">
      {Chart ? (
        <Chart {...props} />
      ) : (
        <div
          className="flex w-full items-center justify-center text-[12px] text-muted-app"
          style={{ height }}
        >
          در حال بارگذاری نمودار...
        </div>
      )}
    </div>
  );
}
