"use client";

import {
  INSTRUMENT_IDS,
  INSTRUMENTS,
  type InstrumentId,
} from "@/lib/market/instruments";
import { cn } from "@/lib/utils";

type Props = {
  value: InstrumentId;
  onChange: (id: InstrumentId) => void;
  className?: string;
  size?: "sm" | "md";
};

export function InstrumentTabs({
  value,
  onChange,
  className,
  size = "md",
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        className
      )}
      role="tablist"
      aria-label="انتخاب فلز"
    >
      {INSTRUMENT_IDS.map((id) => {
        const meta = INSTRUMENTS[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "rounded-full border transition-colors",
              size === "sm"
                ? "min-h-9 px-3 py-1 text-[12px]"
                : "min-h-10 px-3.5 py-1.5 text-[13px]",
              active
                ? "border-transparent text-[#0A0C0E]"
                : "border-white/10 text-muted-app hover:border-white/20 hover:text-text"
            )}
            style={
              active
                ? { backgroundColor: meta.accent }
                : undefined
            }
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
