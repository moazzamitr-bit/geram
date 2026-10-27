"use client";

import { useAppData } from "@/lib/app/app-data";
import { INSTRUMENTS, type InstrumentId } from "@/lib/market/instruments";
import { tradePathForInstrument } from "@/lib/market/trade-routes";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ORDER: InstrumentId[] = ["gold18", "silver925", "copper"];

const DOT: Record<InstrumentId, string> = {
  gold18: "#FFB800",
  silver925: "#B7BDC7",
  copper: "#C4784A",
};

/** Thin live strip: metal dot, price, and a colored percent chip. */
export function PriceTicker({ className }: { className?: string }) {
  const store = useAppData();

  return (
    <div
      className={cn(
        "flex items-center gap-4 overflow-x-auto whitespace-nowrap [scrollbar-width:none]",
        className
      )}
      aria-label="قیمت لحظه‌ای فلزات"
    >
      {ORDER.map((id) => {
        const meta = INSTRUMENTS[id];
        const buy = store.getTradePrice(id, "BUY");
        const sell = store.getTradePrice(id, "SELL");
        const change = store.marketQuotes[id]?.changePercent ?? null;
        const up = (change ?? 0) >= 0;
        return (
          <Link
            key={id}
            href={tradePathForInstrument(id)}
            className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary transition-colors hover:text-text"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: DOT[id] }} />
            <span>{meta.label}</span>
            <span className="tabular-nums text-text">
              {buy > 0
                ? buy === sell
                  ? `${buy.toLocaleString("fa-IR")} تومان`
                  : `خرید ${buy.toLocaleString("fa-IR")} · فروش ${sell.toLocaleString("fa-IR")}`
                : "—"}
            </span>
            {change != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  up ? "bg-[#E7F6EC] text-[#1B9E4B]" : "bg-[#FDECEC] text-[#E5484D]"
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
