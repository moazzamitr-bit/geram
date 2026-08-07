"use client";

import { GoldButton } from "@/components/ui/GoldButton";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

type TradeSuccessSheetProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  goldLabel?: string;
  amountLabel?: string;
  feeLabel?: string;
  trackingCode?: string;
  statusLabel?: string;
  receiptHref: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose?: () => void;
};

export function TradeSuccessSheet({
  open,
  title,
  subtitle,
  goldLabel,
  amountLabel,
  feeLabel,
  trackingCode,
  statusLabel,
  receiptHref,
  secondaryLabel = "بستن",
  onSecondary,
  onClose,
}: TradeSuccessSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-success-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label="بستن"
        onClick={onClose ?? onSecondary}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-t-3xl border border-white/10 bg-card-app p-6 shadow-2xl sm:rounded-3xl",
          "animate-sheet-in"
        )}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-positive/15 text-positive">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <h2
          id="trade-success-title"
          className="text-center text-[22px] font-extrabold text-text"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-center text-[13px] leading-7 text-muted-app">
            {subtitle}
          </p>
        )}

        <dl className="mt-6 space-y-3 rounded-2xl border border-white/[0.06] bg-[#0A0C0E]/80 px-4 py-4 text-[13px]">
          {goldLabel && <SheetRow label="مقدار طلا" value={goldLabel} highlight />}
          {amountLabel && <SheetRow label="مبلغ" value={amountLabel} />}
          {feeLabel && <SheetRow label="کارمزد" value={feeLabel} />}
          {statusLabel && <SheetRow label="وضعیت" value={statusLabel} />}
          {trackingCode && (
            <SheetRow label="کد رهگیری" value={trackingCode} mono />
          )}
        </dl>

        <div className="mt-6 flex flex-col gap-2.5">
          <Link href={receiptHref} className="w-full">
            <GoldButton type="button" className="w-full">
              مشاهده رسید
            </GoldButton>
          </Link>
          {onSecondary && (
            <GoldButton
              type="button"
              variant="secondary"
              className="w-full"
              onClick={onSecondary}
            >
              {secondaryLabel}
            </GoldButton>
          )}
        </div>
      </div>
    </div>
  );
}

function SheetRow({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-app">{label}</dt>
      <dd
        className={cn(
          "tabular-nums text-text",
          highlight && "font-bold text-gold",
          mono && "font-mono text-[12px] tracking-wide"
        )}
        dir={mono ? "ltr" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
