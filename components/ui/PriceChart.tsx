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
  instrument?: string;
  /** Stroke color. Marketing charts keep the default gold line. */
  stroke?: string;
  appearance?: "dark" | "light";
  showAxis?: boolean;
};

export function PriceChart({
  variant = "portfolio",
  className,
  height = 88,
  range = "7d",
  instrument = "gold18",
  stroke = "#F0C568",
  appearance = "dark",
  showAxis = false,
}: PriceChartProps) {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/market/history?range=${range}&instrument=${instrument}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
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
  }, [range, instrument]);

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

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center text-[12px] text-muted-app",
          className
        )}
        style={{ height }}
      >
        داده‌ای برای نمایش وجود ندارد
      </div>
    );
  }

  const gradId = `goldFill-${variant}-${stroke.replace("#", "")}`;
  const light = appearance === "light";
  const axisFill = light ? "#a8a29e" : "#8e928d";

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={showAxis ? { top: 8, right: 8, left: 0, bottom: 0 } : { top: 4, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={light ? 0.28 : 0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            hide={!showAxis}
            tick={{ fontSize: 10, fill: axisFill }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            hide={!showAxis}
            orientation="left"
            width={showAxis ? 52 : 0}
            tick={{ fontSize: 10, fill: axisFill }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              Number(value).toLocaleString("fa-IR", { notation: "compact", maximumFractionDigits: 1 })
            }
            domain={[
              (dataMin: number) => dataMin - domainPad,
              (dataMax: number) => dataMax + domainPad,
            ]}
          />
          <Tooltip
            contentStyle={{
              background: light ? "#ffffff" : "#14191D",
              border: light ? "1px solid rgba(28,25,23,0.08)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              color: light ? "#1c1917" : "#F4F2ED",
              fontSize: 12,
              direction: "rtl",
            }}
            labelFormatter={(label) => String(label)}
            formatter={(value) => [formatToman(Number(value)), "قیمت"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={variant === "market" ? 2.25 : 1.75}
            fill={`url(#${gradId})`}
            isAnimationActive
            animationDuration={450}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
