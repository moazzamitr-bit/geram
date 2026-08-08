"use client";

import { cn, formatToman } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartRange = "1d" | "7d" | "1m" | "3m" | "1y";

type Point = { label: string; value: number };

type PriceChartProps = {
  variant?: "portfolio" | "market";
  className?: string;
  height?: number;
  range?: ChartRange;
};

export function PriceChart({
  variant = "portfolio",
  className,
  height = 88,
  range = "7d",
}: PriceChartProps) {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/market/history?range=${range}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("history failed");
        const json = (await res.json()) as {
          points?: { label: string; value: number }[];
        };
        if (!cancelled) {
          setData(
            (json.points ?? []).map((p) => ({
              label: p.label,
              value: p.value,
            }))
          );
        }
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          setError(true);
          setData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [range]);

  const domainPad = useMemo(() => {
    if (!data.length) return 100_000;
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, max * 0.01);
    return Math.round(span * 0.08);
  }, [data]);

  if (loading && data.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center text-[12px] text-muted-app",
          className
        )}
        style={{ height }}
      >
        در حال بارگذاری نمودار...
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center text-[12px] text-muted-app",
          className
        )}
        style={{ height }}
      >
        نمودار در دسترس نیست
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`goldFill-${variant}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D6A84B" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#D6A84B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis
            hide
            domain={[
              (dataMin: number) => dataMin - domainPad,
              (dataMax: number) => dataMax + domainPad,
            ]}
          />
          <Tooltip
            contentStyle={{
              background: "#14191D",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              color: "#F4F2ED",
              fontSize: 12,
              direction: "rtl",
            }}
            labelFormatter={(label) => String(label)}
            formatter={(value) => [formatToman(Number(value)), "قیمت"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#F0C568"
            strokeWidth={variant === "market" ? 2.25 : 1.75}
            fill={`url(#goldFill-${variant})`}
            isAnimationActive
            animationDuration={450}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
