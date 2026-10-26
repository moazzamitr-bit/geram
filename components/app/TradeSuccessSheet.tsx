"use client";

import { ReceiptSheet, type ReceiptRow } from "@/components/app/ReceiptSheet";

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

/** Buy/sell receipt, in the shared ReceiptSheet style. */
export function TradeSuccessSheet(p: TradeSuccessSheetProps) {
  const rows: ReceiptRow[] = [
    { label: "فلز", value: p.metalLabel },
    { label: "مبلغ کل", value: p.totalLabel, highlight: true },
    { label: "قیمت هر گرم", value: p.unitPriceLabel },
    ...(p.feeLabel ? [{ label: "کارمزد", value: p.feeLabel }] : []),
    { label: "زمان (تهران)", value: p.whenLabel },
    ...(p.walletLabel ? [{ label: "موجودی کیف پول", value: p.walletLabel }] : []),
    ...(p.metalBalanceLabel ? [{ label: "موجودی فلز", value: p.metalBalanceLabel }] : []),
  ];
  return (
    <ReceiptSheet
      open={p.open}
      title={p.title}
      subtitle="جزئیات همین معامله در تاریخچه هم ذخیره شده است."
      amount={p.gramsLabel}
      amountCaption={p.metalLabel}
      rows={rows}
      trackingCode={p.trackingCode}
      reassurance={["دارایی شما به نام خودتان در دفترکل گرم ثبت شده و پشتوانه فیزیکی دارد."]}
      actions={[
        { label: "مشاهده تاریخچه", href: "/app/transactions", primary: true },
        { label: "معامله جدید", onClick: p.onNewTrade },
        { label: "کیف پول", href: "/app/wallet" },
      ]}
      onClose={p.onClose ?? p.onNewTrade}
    />
  );
}
