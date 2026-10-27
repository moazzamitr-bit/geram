"use client";

import { useEffect, useState } from "react";

type Row = { id: string; title: string; dot: string; price?: number; sell?: number; change?: number };

const INITIAL: Row[] = [
  { id: "gold18", title: "طلای ۱۸ عیار", dot: "#E0A800" },
  { id: "silver925", title: "نقره", dot: "#A8B0BC" },
  { id: "copper", title: "مس", dot: "#C26A3D" },
];

const fmt = (n: number) => n.toLocaleString("fa-IR");

export function LivePrices({ variant = "cards" }: { variant?: "cards" | "list" }) {
  const [rows, setRows] = useState<Row[]>(INITIAL);
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const next = await Promise.all(
        INITIAL.map(async (r) => {
          try {
            const res = await fetch(`/api/market/price?instrument=${r.id}`, { cache: "no-store" });
            const j = await res.json();
            if (!j.ok) return r;
            return { ...r, price: (j.buyToman ?? j.priceToman) as number, sell: (j.sellToman ?? j.priceToman) as number, change: j.changePercent as number };
          } catch {
            return r;
          }
        })
      );
      if (!alive) return;
      setRows(next);
      setUpdated(new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }));
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (variant === "list") {
    return (
      <ul className="divide-y divide-black/[0.06] rounded-3xl border border-black/[0.06] bg-white">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-4">
            <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.dot }} />
              {r.title}
              <span className="text-[12px] font-normal text-muted-app">(هر گرم)</span>
            </span>
            <span className="text-left">
              <span className="text-lg font-bold text-text tabular-nums">{r.price ? fmt(r.price) : "…"}</span>
              <span className="mr-1 text-[12px] text-muted-app">تومان</span>
              {r.sell && r.sell !== r.price ? (
                <span className="block text-[12px] text-muted-app tabular-nums">فروش {fmt(r.sell)}</span>
              ) : null}
            </span>
          </li>
        ))}
        {updated ? (
          <li className="px-5 py-2 text-[12px] text-muted-app">به‌روزرسانی خودکار · آخرین دریافت {updated}</li>
        ) : null}
      </ul>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {rows.map((r) => (
        <div key={r.id} className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_8px_24px_-16px_rgba(28,25,23,0.25)]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] font-medium text-text-secondary">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ background: r.dot }} />
                <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: r.dot }} />
              </span>
              قیمت لحظه‌ای {r.title}
            </span>
            {typeof r.change === "number" ? (
              <span
                dir="ltr"
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                  r.change >= 0 ? "bg-[#E7F6EC] text-[#14773A]" : "bg-[#FDECEC] text-[#B42318]"
                }`}
              >
                {r.change >= 0 ? "+" : ""}
                {r.change.toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-text tabular-nums">{r.price ? fmt(r.price) : "…"}</span>
            <span className="text-[12px] text-muted-app">{r.sell && r.sell !== r.price ? "تومان / گرم (خرید)" : "تومان / گرم"}</span>
          </div>
          {r.sell && r.sell !== r.price ? (
            <p className="mt-1 text-[12px] text-text-secondary tabular-nums">فروش {fmt(r.sell)} تومان</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
