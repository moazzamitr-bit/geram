"use client";

import { useDemoStore } from "@/lib/app/demo-store";
import { INSTRUMENTS, type InstrumentId } from "@/lib/market/instruments";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ORDER: InstrumentId[] = ["gold18", "silver925", "copper"];

/** Live price strip for all three metals (Gerami-style), each linking to its buy page. */
export function PriceTicker({ className }: { className?: string }) {
  const store = useDemoStore();

  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none]",
        className
      )}
      aria-label="قیمت لحظه‌ای فلزات"
    >
      {ORDER.map((id) => {
        const meta = INSTRUMENTS[id];
        const price = store.getMarketPrice(id);
        const change = store.marketQuotes[id]?.changePercent ?? null;
        const up = (change ?? 0) >= 0;
        return (
          <Link
            key={id}
            href={`/app/buy?instrument=${id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:border-gold/30 hover:text-text"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} />
            <span>{meta.label}</span>
            <span className="tabular-nums text-text">
              {price > 0 ? price.toLocaleString("fa-IR") : "—"}
            </span>
            {change != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 tabular-nums",
                  up ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
                )}
                dir="ltr"
              >
                {up ? "+" : ""}
                {change.toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
