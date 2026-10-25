import { assetToUiInstrument, type AssetCode } from "@/lib/core/assets";
import { irrToSafeTomanNumber, mulDivFloor, UG_PER_GRAM, ugToSafeMgNumber } from "@/lib/core/money";
import type { JournalEntry, Quote, Trade } from "@/lib/core/types";
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

/** Locked execution toman/gram, or the settled metal leg when the quote is absent. */
export function executedTomanPerGram(trade: Trade, quote?: Quote | null): number {
  if (quote && quote.id === trade.quoteId && quote.executionPriceIrrPerGram > 0n) {
    return irrToSafeTomanNumber(quote.executionPriceIrrPerGram);
  }
  if (trade.weightUg <= 0n) return 0;
  const metalIrr = trade.side === "BUY" ? trade.netIrr : trade.grossIrr;
  if (metalIrr <= 0n) return 0;
  return irrToSafeTomanNumber(mulDivFloor(metalIrr, UG_PER_GRAM, trade.weightUg));
}

export function tradeToDemoTx(trade: Trade, quote?: Quote | null): UiTransaction {
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
    pricePerGram: executedTomanPerGram(trade, quote),
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

function faStamp(iso: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** One user-visible row for a ledger journal that touches this holder. */
export function journalToUi(entry: JournalEntry, userId: string): UiTransaction {
  const mine = entry.lines.filter((line) => line.holderId === userId);
  const irr = mine.find((line) => line.accountCode === "USER_AVAILABLE" && line.asset === "IRR");
  const metal = mine.find((line) => line.accountCode === "USER_AVAILABLE" && line.asset !== "IRR");
  const fee = entry.lines.find((line) => line.accountCode === "PLATFORM_FEE_REVENUE");
  let type: UiTransaction["type"] = "کارمزد";
  if (entry.reason === "BUY_SETTLE") type = "خرید";
  else if (entry.reason === "SELL_SETTLE") type = "فروش";
  else if (irr && irr.credit > irr.debit) type = "واریز";
  else if (irr && irr.debit > irr.credit) type = "برداشت";
  else if (metal && metal.credit > metal.debit) type = "خرید";
  else if (metal && metal.debit > metal.credit) type = "فروش";
  const amountIrr = irr ? (irr.credit > 0n ? irr.credit : irr.debit) : 0n;
  const weightUg = metal ? (metal.credit > 0n ? metal.credit : metal.debit) : 0n;
  const feeIrr = fee?.credit ?? 0n;
  const asset = metal && metal.asset !== "IRR" ? (metal.asset as AssetCode) : "GOLD";
  const label =
    type === "واریز"
      ? "شارژ دفترکل"
      : type === "برداشت"
        ? "برگشت شارژ"
        : entry.reason;
  return {
    id: entry.id,
    trackingCode: entry.refId || entry.id,
    type,
    instrument: assetToUiInstrument(asset),
    goldMg: ugToSafeMgNumber(weightUg),
    amountRial: irrToSafeTomanNumber(amountIrr),
    feeRial: irrToSafeTomanNumber(feeIrr),
    pricePerGram: journalTomanPerGram(type, amountIrr, feeIrr, weightUg),
    status: "تکمیل‌شده",
    createdAt: faStamp(entry.createdAt),
    timeline: [
      { label, done: true },
      { label: "ثبت در دفترکل", done: true },
    ],
    note: entry.reason,
    paymentRef: entry.refType,
  };
}

export function serializeJournal(entry: JournalEntry) {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    reason: entry.reason,
    refType: entry.refType,
    refId: entry.refId,
    lines: entry.lines.map((line) => ({
      accountCode: line.accountCode,
      holderId: line.holderId,
      asset: line.asset,
      debit: line.debit.toString(),
      credit: line.credit.toString(),
    })),
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
    requestedIrr: quote.requestedIrr == null ? null : quote.requestedIrr.toString(),
    requestedWeightUg: quote.requestedWeightUg == null ? null : quote.requestedWeightUg.toString(),
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

export function serializeTrade(trade: Trade, quote?: Quote | null) {
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
    ui: tradeToDemoTx(trade, quote),
  };
}

function journalTomanPerGram(
  type: UiTransaction["type"],
  amountIrr: bigint,
  feeIrr: bigint,
  weightUg: bigint
): number {
  if ((type !== "خرید" && type !== "فروش") || weightUg <= 0n) return 0;
  const metalIrr = type === "خرید" ? amountIrr - feeIrr : amountIrr + feeIrr;
  if (metalIrr <= 0n) return 0;
  return irrToSafeTomanNumber(mulDivFloor(metalIrr, UG_PER_GRAM, weightUg));
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
