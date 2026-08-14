"use client";

import {
  INSTRUMENT_IDS,
  INSTRUMENTS,
  type InstrumentId,
} from "@/lib/market/instruments";
import { formatToman } from "@/lib/utils";
import { ArrowUpLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Quote = {
  instrument: InstrumentId;
  priceToman: number;
  changePercent: number | null;
  stale?: boolean;
};

const FALLBACK: Quote[] = INSTRUMENT_IDS.map((id) => ({
  instrument: id,
  priceToman: INSTRUMENTS[id].fallbackPriceToman,
  changePercent: null,
  stale: true,
}));

export function LiveMetalsSection() {
  const [quotes, setQuotes] = useState<Quote[]>(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/market/price?all=1", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { quotes?: Quote[] };
        if (!cancelled && json.quotes?.length) {
          setQuotes(
            json.quotes.map((q) => ({
              instrument: q.instrument,
              priceToman: q.priceToman,
              changePercent: q.changePercent,
              stale: q.stale,
            }))
          );
          setLoaded(true);
        }
      } catch {
        /* keep fallback */
      }
    }

    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <section
      id="metals"
      className="relative scroll-mt-[84px] pb-4 pt-2 md:pb-6"
      aria-label="قیمت لایو فلزات"
    >
      <div className="container-site">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium tracking-wide text-gold">
              بازار لایو
            </p>
            <h2 className="mt-1 text-[24px] font-extrabold text-text md:text-[28px]">
              قیمت طلا، نقره و مس
            </h2>
          </div>
          <p className="text-[12px] text-text-muted">
            {loaded ? "به‌روزرسانی هر ۳۰ ثانیه" : "در حال دریافت قیمت…"}
          </p>
        </div>

        <ul className="grid gap-0 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(20,25,29,0.95),rgba(8,11,13,0.98))] sm:grid-cols-3">
          {INSTRUMENT_IDS.map((id, index) => {
            const meta = INSTRUMENTS[id];
            const quote =
              quotes.find((q) => q.instrument === id) ?? FALLBACK[index]!;
            const change = quote.changePercent;
            return (
              <li
                key={id}
                className={`relative px-6 py-7 ${
                  index < INSTRUMENT_IDS.length - 1
                    ? "border-b border-white/[0.06] sm:border-b-0 sm:border-l"
                    : ""
                }`}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${meta.accent}66, transparent)`,
                  }}
                />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] text-text-secondary">{meta.title}</p>
                    <p className="mt-2 text-[26px] font-extrabold tabular-nums tracking-tight text-text md:text-[28px]">
                      {formatToman(quote.priceToman)}
                    </p>
                    <p
                      className={`mt-1.5 text-[12px] tabular-nums ${
                        change == null
                          ? "text-text-muted"
                          : change >= 0
                            ? "text-positive"
                            : "text-negative"
                      }`}
                    >
                      {change == null
                        ? "تغییر —"
                        : `${change >= 0 ? "+" : ""}${change.toLocaleString("fa-IR", {
                            maximumFractionDigits: 2,
                          })}٪`}
                      <span className="text-text-muted"> / گرم</span>
                    </p>
                  </div>
                  <span
                    className="h-10 w-10 shrink-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, #fff8, transparent 40%), linear-gradient(145deg, ${meta.accent}, #1a1510)`,
                      boxShadow: `0 0 24px ${meta.accent}33`,
                    }}
                    aria-hidden
                  />
                </div>

                <div className="mt-6 flex items-center gap-4">
                  <Link
                    href={`/app/buy?instrument=${id}`}
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-gold transition-colors hover:text-gold-highlight"
                  >
                    خرید {meta.label}
                    <ArrowUpLeft size={14} />
                  </Link>
                  <Link
                    href={`/app/market`}
                    className="text-[12px] text-text-muted transition-colors hover:text-text-secondary"
                  >
                    نمودار
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
