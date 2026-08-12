"use client";

import { LogoMark } from "@/components/brand/BrandLogo";
import { PriceChart } from "@/components/ui/PriceChart";
import { cn, formatFaNumber } from "@/lib/utils";
import { Bell, Cuboid } from "lucide-react";
import { ReactNode } from "react";

type PhoneMockupProps = {
  children?: ReactNode;
  className?: string;
  screen?: "portfolio" | "market" | "buy";
  tilt?: number;
  style?: React.CSSProperties;
};

function PhoneChrome({
  children,
  className,
  tilt = 0,
  style,
}: {
  children: ReactNode;
  className?: string;
  tilt?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[9/19.5] w-full max-w-[280px] select-none",
        className
      )}
      style={{
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        ...style,
      }}
    >
      {/* Outer metallic edge */}
      <div
        className="absolute inset-0 rounded-[38px] p-[2px]"
        style={{
          background:
            "linear-gradient(145deg, #F0C568 0%, #8A6526 28%, #2A2A2A 50%, #D6A84B 78%, #A97A2E 100%)",
          boxShadow:
            "0 40px 80px rgba(0,0,0,0.55), 0 12px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        {/* Frame */}
        <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-[#0A0C0E]">
          {/* Side highlight */}
          <div className="pointer-events-none absolute inset-y-8 left-0 w-px bg-gradient-to-b from-transparent via-gold-highlight/40 to-transparent" />
          <div className="pointer-events-none absolute inset-y-8 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Dynamic Island */}
          <div className="absolute left-1/2 top-3 z-20 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black shadow-inner" />

          {/* Screen */}
          <div className="h-full w-full overflow-hidden rounded-[36px] bg-[#080B0D] pt-9 pb-4 px-3.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioScreen() {
  return (
    <div className="flex h-full flex-col gap-3 text-right">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="اعلان‌ها"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.07]"
        >
          <Bell className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text">سلام، مهدی</span>
          <LogoMark size={24} />
        </div>
      </div>

      <div>
        <p className="text-[11px] text-text-muted">ارزش دارایی من</p>
        <p className="mt-1 text-[26px] font-extrabold leading-none tracking-tight text-text">
          {formatFaNumber(24630000)}
        </p>
        <p className="mt-1 text-[11px] text-text-secondary">تومان</p>
        <p className="mt-2 inline-flex rounded-full bg-positive/10 px-2 py-0.5 text-[11px] text-positive">
          +۳.۴٪ این ماه
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-card/80 p-2">
        <PriceChart variant="portfolio" height={72} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {["خرید فلز", "فروش فلز"].map((label) => (
          <button
            key={label}
            type="button"
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-card-elevated px-2 py-3 transition-colors"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/10">
              <Cuboid className="h-4 w-4 text-gold" strokeWidth={1.5} />
            </span>
            <span className="text-[11px] font-medium text-text">{label}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto space-y-1.5 rounded-2xl border border-white/[0.07] bg-card-elevated p-3">
        {[
          ["طلا", "۳.۲۴۱ گرم"],
          ["نقره", "۵.۰۰۰ گرم"],
          ["مس", "۲۰۰ گرم"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">{label}</span>
            <span className="font-semibold text-text">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketScreen() {
  return (
    <div className="flex h-full flex-col gap-3 text-right">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">بازار</span>
        <span className="text-[13px] font-bold text-text">فلزات</span>
      </div>

      <div className="space-y-2">
        {[
          ["طلا ۱۸", 19_205_600, "#D6A84B"],
          ["نقره ۹۲۵", 383_957, "#C0C7D1"],
          ["مس", 2_560, "#B87333"],
        ].map(([label, price, color]) => (
          <div
            key={String(label)}
            className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-card/70 px-2.5 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: String(color) }}
              />
              <span className="text-[11px] text-text">{label}</span>
            </div>
            <span className="text-[11px] font-bold tabular-nums text-text">
              {formatFaNumber(Number(price))}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        {["امروز", "هفته", "ماه", "سال"].map((tab, i) => (
          <span
            key={tab}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px]",
              i === 0
                ? "bg-gold/15 text-gold"
                : "bg-white/[0.03] text-text-muted"
            )}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-card/80 p-2">
        <PriceChart variant="market" height={110} />
      </div>

      <div className="mt-auto grid grid-cols-3 gap-1.5">
        {["طلا", "نقره", "مس"].map((label, i) => (
          <span
            key={label}
            className={cn(
              "rounded-lg py-2 text-center text-[10px] font-semibold",
              i === 0 ? "bg-gold/15 text-gold" : "bg-white/[0.04] text-text-muted"
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function BuyScreen() {
  return (
    <div className="flex h-full flex-col gap-3 text-right">
      <p className="text-[14px] font-bold text-text">خرید فلز</p>

      <div className="flex gap-1.5">
        {["طلا", "نقره", "مس"].map((label, i) => (
          <span
            key={label}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px]",
              i === 1
                ? "bg-gold/15 text-gold"
                : "bg-white/[0.03] text-text-muted"
            )}
          >
            {label}
          </span>
        ))}
      </div>

      <label className="block rounded-2xl border border-white/[0.07] bg-card px-3 py-2.5">
        <span className="text-[10px] text-text-muted">مبلغ</span>
        <p className="mt-1 text-[15px] font-semibold text-text">
          {formatFaNumber(2_000_000)} تومان
        </p>
      </label>

      <label className="block rounded-2xl border border-white/[0.07] bg-card px-3 py-2.5">
        <span className="text-[10px] text-text-muted">وزن تقریبی نقره</span>
        <p className="mt-1 text-[15px] font-semibold text-gold">۵.۱۲ گرم</p>
      </label>

      <div className="space-y-2 rounded-2xl border border-white/[0.07] bg-card-elevated p-3 text-[11px]">
        <div className="flex justify-between">
          <span className="text-text">قیمت هر گرم</span>
          <span className="text-text-muted">{formatFaNumber(383_957)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text">کارمزد</span>
          <span className="text-text-muted">{formatFaNumber(14_000)}</span>
        </div>
        <div className="my-1 h-px bg-white/[0.06]" />
        <div className="flex justify-between font-semibold">
          <span className="text-text">مبلغ نهایی</span>
          <span className="text-gold">{formatFaNumber(2_014_000)}</span>
        </div>
      </div>

      <button
        type="button"
        className="mt-auto h-11 w-full rounded-xl bg-gold-gradient text-[13px] font-bold text-[#0A0C0E]"
      >
        تایید و پرداخت
      </button>
    </div>
  );
}

export function PhoneMockup({
  children,
  className,
  screen = "portfolio",
  tilt = 0,
  style,
}: PhoneMockupProps) {
  const content =
    children ??
    (screen === "market" ? (
      <MarketScreen />
    ) : screen === "buy" ? (
      <BuyScreen />
    ) : (
      <PortfolioScreen />
    ));

  return (
    <PhoneChrome className={className} tilt={tilt} style={style}>
      {content}
    </PhoneChrome>
  );
}
