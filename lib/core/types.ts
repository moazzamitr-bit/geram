import type { AssetCode, LedgerAsset } from "@/lib/core/assets";
import type { Irr, Microgram } from "@/lib/core/money";

export const PLATFORM_HOLDER = "00000000-0000-4000-a000-000000000001";

export type AccountCode =
  | "USER_AVAILABLE"
  | "USER_RESERVED"
  | "PLATFORM_AVAILABLE"
  | "PLATFORM_RESERVED"
  | "PLATFORM_CLEARING"
  | "PLATFORM_FEE_REVENUE"
  | "PAYMENT_GATEWAY_CLEARING"
  | "BANK_SETTLEMENT_CLEARING"
  | "PLATFORM_CASH_CONTROL"
  | "PLATFORM_OPENING"
  | "PLATFORM_RESTRICTED";

export type LedgerAccount = {
  id: string;
  holderId: string;
  accountCode: AccountCode;
  asset: LedgerAsset;
  balance: bigint;
};

export type JournalLine = {
  accountCode: AccountCode;
  holderId: string;
  asset: LedgerAsset;
  debit: bigint;
  credit: bigint;
};

export type JournalEntry = {
  id: string;
  createdAt: string;
  reason: string;
  refType: string;
  refId: string;
  lines: JournalLine[];
};

export type QuoteStatus = "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED";
export type QuoteSide = "BUY" | "SELL";
export type InputMode = "RIAL_AMOUNT" | "METAL_WEIGHT";

export type Quote = {
  id: string;
  userId: string;
  asset: AssetCode;
  side: QuoteSide;
  inputMode: InputMode;
  requestedIrr: Irr;
  requestedWeightUg: Microgram;
  referencePriceIrrPerGram: Irr;
  executionPriceIrrPerGram: Irr;
  grossIrr: Irr;
  feeIrr: Irr;
  netIrr: Irr;
  weightUg: Microgram;
  feeSnapshotJson: string;
  spreadSnapshotJson: string;
  priceSourceSnapshotJson: string;
  createdAt: string;
  expiresAt: string;
  status: QuoteStatus;
};

export type TradeStatus =
  | "CREATED"
  | "RESERVED"
  | "LEDGER_POSTED"
  | "SETTLED"
  | "FAILED"
  | "CANCELLED";

export type Trade = {
  id: string;
  userId: string;
  quoteId: string;
  asset: AssetCode;
  side: QuoteSide;
  status: TradeStatus;
  weightUg: Microgram;
  grossIrr: Irr;
  feeIrr: Irr;
  netIrr: Irr;
  idempotencyKey: string;
  createdAt: string;
  trackingCode: string;
};

export type OutboxStatus = "PENDING" | "PROCESSED" | "FAILED";

export type OutboxEvent = {
  id: string;
  topic: string;
  payloadJson: string;
  createdAt: string;
  processedAt: string | null;
  attempts: number;
  status: OutboxStatus;
  lastError: string | null;
};

export type IdempotencyRecord = {
  key: string;
  userId: string;
  method: string;
  path: string;
  requestHash: string;
  responseJson: string | null;
  status: "PENDING" | "COMPLETED";
  createdAt: string;
};

export type ReservationStatus = "OPEN" | "CONSUMED" | "RELEASED";

export type MetalSoftReservation = {
  id: string;
  quoteId: string;
  asset: AssetCode;
  quantityUg: Microgram;
  status: ReservationStatus;
  createdAt: string;
};

export type CostBasis = {
  holderId: string;
  asset: AssetCode;
  quantityUg: Microgram;
  costIrr: Irr;
};

export type PriceHealth =
  | "LIVE"
  | "DEGRADED"
  | "STALE"
  | "UNAVAILABLE"
  | "PARSE_ERROR"
  | "DISAGREEMENT";

export type PriceQuote = {
  instrument: string;
  asset: AssetCode;
  irrPerGram: Irr;
  source: string;
  sourceMode: "TEMPORARY_PUBLIC" | "SUPPLIER_EXECUTABLE";
  permittedForProduction: boolean;
  health: PriceHealth;
  observedAt: string;
  stale: boolean;
};

export class CoreError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400
  ) {
    super(message);
    this.name = "CoreError";
  }
}

export const TRADE_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  CREATED: ["RESERVED", "FAILED", "CANCELLED"],
  RESERVED: ["LEDGER_POSTED", "FAILED", "CANCELLED"],
  LEDGER_POSTED: ["SETTLED", "FAILED"],
  SETTLED: [],
  FAILED: [],
  CANCELLED: [],
};

export function assertTradeTransition(from: TradeStatus, to: TradeStatus) {
  if (!TRADE_TRANSITIONS[from].includes(to)) {
    throw new CoreError(
      "invalid_trade_transition",
      `Cannot move trade ${from} → ${to}`,
      409
    );
  }
}

export function assertJournalBalanced(lines: JournalLine[]) {
  const byAsset = new Map<string, bigint>();
  for (const line of lines) {
    if (line.debit < 0n || line.credit < 0n) {
      throw new CoreError("invalid_journal", "debit/credit must be >= 0");
    }
    if ((line.debit === 0n) === (line.credit === 0n)) {
      throw new CoreError("invalid_journal", "exactly one of debit/credit must be set");
    }
    const cur = byAsset.get(line.asset) ?? 0n;
    byAsset.set(line.asset, cur + line.debit - line.credit);
  }
  for (const [asset, net] of byAsset) {
    if (net !== 0n) {
      throw new CoreError(
        "unbalanced_journal",
        `Asset ${asset} net ${net.toString()} != 0`
      );
    }
  }
}
