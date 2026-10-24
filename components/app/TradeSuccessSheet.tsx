"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

type TradeSuccessSheetProps = {
  open: boolean;
  title: string;
  metalLabel: string;
  gramsLabel: string;
  unitPriceLabel: string;
  totalLabel: string;
  feeLabel?: string;
  trackingCode: string;
  whenLabel: string;
  walletLabel?: string;
  metalBalanceLabel?: string;
  onNewTrade: () => void;
  onClose?: () => void;
};

export function TradeSuccessSheet({
  open,
  title,
  metalLabel,
  gramsLabel,
  unitPriceLabel,
  totalLabel,
  feeLabel,
  trackingCode,
  whenLabel,
  walletLabel,
  metalBalanceLabel,
  onNewTrade,
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
        className="absolute inset-0 bg-[#1C1917]/40"
        aria-label="بستن"
        onClick={onClose ?? onNewTrade}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-black/[0.06] bg-[#FBF8F2] p-5 shadow-[0_24px_60px_rgba(28,25,23,0.18)] animate-sheet-in sm:rounded-3xl sm:p-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F6EE] text-[#1F9D55]">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <h2 id="trade-success-title" className="text-center text-[22px] font-extrabold text-text">
          {title}
        </h2>
        <p className="mt-2 text-center text-[13px] leading-6 text-muted-app">
          جزئیات همین معامله در تاریخچه هم ذخیره شده است.
        </p>

        <dl className="mt-5 space-y-3 rounded-2xl bg-white px-4 py-4 text-[13px]">
          <SheetRow label="فلز" value={metalLabel} />
          <SheetRow label="وزن" value={gramsLabel} highlight />
          <SheetRow label="قیمت هر گرم" value={unitPriceLabel} />
          <SheetRow label="مبلغ کل" value={totalLabel} highlight />
          {feeLabel ? <SheetRow label="کارمزد" value={feeLabel} /> : null}
          <SheetRow label="کد رهگیری" value={trackingCode} mono />
          <SheetRow label="زمان (تهران)" value={whenLabel} />
          {walletLabel ? <SheetRow label="موجودی کیف پول" value={walletLabel} /> : null}
          {metalBalanceLabel ? <SheetRow label="موجودی فلز" value={metalBalanceLabel} /> : null}
        </dl>

        <div className="mt-5 flex flex-col gap-2.5">
          <Link
            href="/app/transactions"
            className="flex h-12 items-center justify-center rounded-xl bg-gold-gradient text-[15px] font-bold text-[#0A0C0E]"
          >
            مشاهده تاریخچه
          </Link>
          <Link
            href="/app/wallet"
            className="flex h-12 items-center justify-center rounded-xl border border-black/10 bg-white text-[15px] font-bold text-text"
          >
            کیف پول
          </Link>
          <button
            type="button"
            onClick={onNewTrade}
            className="flex h-12 items-center justify-center rounded-xl border border-black/10 bg-white text-[15px] font-bold text-text"
          >
            معامله جدید
          </button>
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
          "text-left tabular-nums text-text",
          highlight && "font-bold text-[#8A6526]",
          mono && "font-mono text-[12px] tracking-wide"
        )}
        dir={mono ? "ltr" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
