import { assetToUiInstrument } from "@/lib/core/assets";
import { irrToSafeTomanNumber, ugToSafeMgNumber } from "@/lib/core/money";
import type { Quote, Trade } from "@/lib/core/types";
import type { WalletView } from "@/lib/core/engine";
import type { InstrumentId } from "@/lib/market/instruments";

export type UiTransaction = {
  id: string;
  trackingCode: string;
  type: "خرید" | "فروش" | "واریز" | "برداشت" | "تحویل" | "کارمزد";
  instrument: InstrumentId;
  goldMg: number;
  amountRial: number;
  feeRial: number;
  pricePerGram: number;
  status: "تکمیل‌شده" | "در انتظار تسویه" | "در حال پردازش" | "ناموفق" | "لغو شده";
  createdAt: string;
  timeline: { label: string; done: boolean; at?: string }[];
  paymentRef?: string;
  note?: string;
};

export function quoteToUiPreview(quote: Quote) {
  return {
    id: quote.id,
    instrument: assetToUiInstrument(quote.asset),
    fee: irrToSafeTomanNumber(quote.feeIrr),
    net: irrToSafeTomanNumber(quote.netIrr),
    gross: irrToSafeTomanNumber(quote.grossIrr),
    goldMg: ugToSafeMgNumber(quote.weightUg),
    pricePerGram: irrToSafeTomanNumber(quote.executionPriceIrrPerGram),
    expiresAt: quote.expiresAt,
    status: quote.status,
  };
}

export function tradeToDemoTx(trade: Trade, quote?: Quote): UiTransaction {
  const instrument = assetToUiInstrument(trade.asset) as InstrumentId;
  const type = trade.side === "BUY" ? "خرید" : "فروش";
  const settled = trade.status === "SETTLED";
  return {
    id: trade.id,
    trackingCode: trade.trackingCode,
    type,
    instrument,
    goldMg: ugToSafeMgNumber(trade.weightUg),
    amountRial: irrToSafeTomanNumber(trade.side === "BUY" ? trade.grossIrr : trade.netIrr),
    feeRial: irrToSafeTomanNumber(trade.feeIrr),
    pricePerGram: quote
      ? irrToSafeTomanNumber(quote.executionPriceIrrPerGram)
      : 0,
    status: settled ? "تکمیل‌شده" : trade.status === "FAILED" ? "ناموفق" : "در حال پردازش",
    createdAt: new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(trade.createdAt)),
    timeline: [
      { label: "سفارش ایجاد شد", done: true },
      { label: "تأیید معامله", done: settled },
      { label: trade.side === "BUY" ? "پرداخت از کیف پول" : "واریز به کیف پول", done: settled },
      { label: "ثبت نهایی", done: settled },
    ],
    paymentRef: trade.side === "BUY" ? `WALLET-${trade.id.slice(0, 8)}` : undefined,
  };
}

export function walletToUi(wallet: WalletView) {
  return {
    rialAvailable: irrToSafeTomanNumber(wallet.rialAvailable),
    rialPending: irrToSafeTomanNumber(wallet.rialReserved),
    goldMg: ugToSafeMgNumber(wallet.metals.GOLD.availableUg),
    silverMg: ugToSafeMgNumber(wallet.metals.SILVER.availableUg),
    copperMg: ugToSafeMgNumber(wallet.metals.COPPER.availableUg),
  };
}

export function serializeQuote(quote: Quote) {
  return {
    id: quote.id,
    userId: quote.userId,
    asset: quote.asset,
    side: quote.side,
    inputMode: quote.inputMode,
    requestedIrr: quote.requestedIrr.toString(),
    requestedWeightUg: quote.requestedWeightUg.toString(),
    referencePriceIrrPerGram: quote.referencePriceIrrPerGram.toString(),
    executionPriceIrrPerGram: quote.executionPriceIrrPerGram.toString(),
    grossIrr: quote.grossIrr.toString(),
    feeIrr: quote.feeIrr.toString(),
    netIrr: quote.netIrr.toString(),
    weightUg: quote.weightUg.toString(),
    feeSnapshotJson: quote.feeSnapshotJson,
    spreadSnapshotJson: quote.spreadSnapshotJson,
    priceSourceSnapshotJson: quote.priceSourceSnapshotJson,
    createdAt: quote.createdAt,
    expiresAt: quote.expiresAt,
    status: quote.status,
    ui: quoteToUiPreview(quote),
  };
}

export function serializeTrade(trade: Trade) {
  return {
    id: trade.id,
    userId: trade.userId,
    quoteId: trade.quoteId,
    asset: trade.asset,
    side: trade.side,
    status: trade.status,
    weightUg: trade.weightUg.toString(),
    grossIrr: trade.grossIrr.toString(),
    feeIrr: trade.feeIrr.toString(),
    netIrr: trade.netIrr.toString(),
    idempotencyKey: trade.idempotencyKey,
    createdAt: trade.createdAt,
    trackingCode: trade.trackingCode,
    ui: tradeToDemoTx(trade),
  };
}

export function serializeWallet(wallet: WalletView) {
  const ui = walletToUi(wallet);
  return {
    rialAvailableIrr: wallet.rialAvailable.toString(),
    rialReservedIrr: wallet.rialReserved.toString(),
    metals: {
      GOLD: {
        availableUg: wallet.metals.GOLD.availableUg.toString(),
        reservedUg: wallet.metals.GOLD.reservedUg.toString(),
      },
      SILVER: {
        availableUg: wallet.metals.SILVER.availableUg.toString(),
        reservedUg: wallet.metals.SILVER.reservedUg.toString(),
      },
      COPPER: {
        availableUg: wallet.metals.COPPER.availableUg.toString(),
        reservedUg: wallet.metals.COPPER.reservedUg.toString(),
      },
      TEST_METAL: {
        availableUg: wallet.metals.TEST_METAL.availableUg.toString(),
        reservedUg: wallet.metals.TEST_METAL.reservedUg.toString(),
      },
    },
    ui,
  };
}
