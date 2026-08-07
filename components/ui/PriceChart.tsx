"use client";

import { portfolioChartData, chartData } from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PriceChartProps = {
  variant?: "portfolio" | "market";
  className?: string;
  height?: number;
};

export function PriceChart({
  variant = "portfolio",
  className,
  height = 88,
}: PriceChartProps) {
  const data: { label: string; value: number }[] =
    variant === "portfolio"
      ? portfolioChartData.map((d) => ({ label: d.label, value: d.value }))
      : chartData.map((d) => ({ label: d.label, value: d.value }));

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
          <YAxis hide domain={["dataMin - 200000", "dataMax + 200000"]} />
          <Tooltip
            contentStyle={{
              background: "#14191D",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              color: "#F4F2ED",
              fontSize: 12,
              direction: "rtl",
            }}
            formatter={(value) => [
              new Intl.NumberFormat("fa-IR").format(Number(value)),
              "قیمت",
            ]}
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
