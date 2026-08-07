"use client";

import { cn, formatFaNumber } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type AnimatedNumberProps = {
  value: number;
  className?: string;
  durationMs?: number;
  decimals?: number;
  suffix?: string;
  formatter?: (n: number) => string;
};

export function AnimatedNumber({
  value,
  className,
  durationMs = 520,
  decimals = 0,
  suffix,
  formatter,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, reduced]);

  const text =
    formatter?.(display) ??
    formatFaNumber(Number(display.toFixed(decimals)), {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  return (
    <span className={cn("tabular-nums", className)}>
      {text}
      {suffix ? ` ${suffix}` : null}
    </span>
  );
}
