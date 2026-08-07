"use client";

import { cn } from "@/lib/utils";
import { useId } from "react";

type ProgressRingProps = {
  percent: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
};

export function ProgressRing({
  percent,
  size = 72,
  stroke = 5,
  className,
  children,
}: ProgressRingProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `goldRing-${uid}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c - (clamped / 100) * c;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`پیشرفت ${clamped.toLocaleString("fa-IR")} درصد`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8A6526" />
            <stop offset="50%" stopColor="#D6A84B" />
            <stop offset="100%" stopColor="#F0C568" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
