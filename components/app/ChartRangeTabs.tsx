"use client";

import type { ChartRange } from "@/components/ui/PriceChart";
import { cn } from "@/lib/utils";

const RANGES: { id: ChartRange; label: string }[] = [
  { id: "1d", label: "روزانه" },
  { id: "1m", label: "ماهانه" },
  { id: "1y", label: "سالانه" },
];

export function ChartRangeTabs({
  value,
  onChange,
}: {
  value: ChartRange;
  onChange: (next: ChartRange) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-[#F3F1ED] p-1" role="tablist" aria-label="بازه نمودار">
      {RANGES.map((range) => {
        const active = value === range.id;
        return (
          <button
            key={range.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(range.id)}
            className={cn(
              "min-h-8 rounded-full px-3 text-[12px] transition-colors",
              active ? "bg-white font-bold text-text shadow-sm" : "text-muted-app hover:text-text"
            )}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
