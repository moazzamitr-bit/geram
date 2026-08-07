"use client";

import { PriceChart } from "@/components/ui/PriceChart";
import { cn, formatFaNumber } from "@/lib/utils";
import { Bell, ChevronLeft, Cuboid } from "lucide-react";
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
          <LogoMark className="h-6 w-6" />
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
        {["خرید طلا", "فروش طلا"].map((label) => (
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

      <div className="mt-auto flex items-center justify-between rounded-2xl border border-white/[0.07] bg-card-elevated p-3">
        <ChevronLeft className="h-4 w-4 text-gold" strokeWidth={1.5} />
        <div className="text-right">
          <p className="text-[10px] text-text-muted">موجودی طلای شما</p>
          <p className="mt-0.5 text-[16px] font-bold text-gold">۳.۲۴۱ گرم</p>
          <p className="mt-0.5 text-[10px] text-text-muted">
            ارزش تقریبی: {formatFaNumber(7850000)} تومان
          </p>
        </div>
      </div>
    </div>
  );
}

function MarketScreen() {
  return (
    <div className="flex h-full flex-col gap-3 text-right">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">بازار</span>
        <span className="text-[13px] font-bold text-text">قیمت طلا</span>
      </div>

      <div>
        <p className="text-[28px] font-extrabold leading-none text-text">
          {formatFaNumber(6854000)}
        </p>
        <p className="mt-1 text-[11px] text-text-secondary">تومان / گرم</p>
        <p className="mt-2 text-[11px] text-positive">+۱.۲٪ امروز</p>
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

      <div className="mt-auto space-y-2 rounded-2xl border border-white/[0.07] bg-card-elevated p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text">بالاترین</span>
          <span className="text-text-muted">{formatFaNumber(6920000)}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text">پایین‌ترین</span>
          <span className="text-text-muted">{formatFaNumber(6710000)}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text">حجم معاملات</span>
          <span className="text-text-muted">۴۲۱ کیلوگرم</span>
        </div>
      </div>
    </div>
  );
}

function BuyScreen() {
  return (
    <div className="flex h-full flex-col gap-3 text-right">
      <p className="text-[14px] font-bold text-text">خرید طلا</p>

      <label className="block rounded-2xl border border-white/[0.07] bg-card px-3 py-2.5">
        <span className="text-[10px] text-text-muted">مبلغ</span>
        <p className="mt-1 text-[15px] font-semibold text-text">
          {formatFaNumber(10000000)} تومان
        </p>
      </label>

      <label className="block rounded-2xl border border-white/[0.07] bg-card px-3 py-2.5">
        <span className="text-[10px] text-text-muted">وزن تقریبی</span>
        <p className="mt-1 text-[15px] font-semibold text-gold">۱.۴۳۵ گرم</p>
      </label>

      <div className="space-y-2 rounded-2xl border border-white/[0.07] bg-card-elevated p-3 text-[11px]">
        <div className="flex justify-between">
          <span className="text-text">قیمت هر گرم</span>
          <span className="text-text-muted">{formatFaNumber(6854000)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text">کارمزد</span>
          <span className="text-text-muted">{formatFaNumber(25000)}</span>
        </div>
        <div className="my-1 h-px bg-white/[0.06]" />
        <div className="flex justify-between font-semibold">
          <span className="text-text">مبلغ نهایی</span>
          <span className="text-gold">{formatFaNumber(10025000)}</span>
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

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-gold", className)}
      fill="none"
      aria-hidden
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M16 6.5 L19.2 12.8 L26 13.6 L20.8 18.2 L22.2 25 L16 21.6 L9.8 25 L11.2 18.2 L6 13.6 L12.8 12.8 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
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
