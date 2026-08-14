import { randomUUID } from "crypto";
import type { AssetCode, LedgerAsset } from "./assets";
import { ALL_ASSETS } from "./assets";
import type {
  AccountCode,
  CostBasis,
  IdempotencyRecord,
  JournalEntry,
  JournalLine,
  LedgerAccount,
  MetalSoftReservation,
  OutboxEvent,
  Quote,
  QuoteStatus,
  ReservationStatus,
  Trade,
  TradeStatus,
} from "./types";
import { PLATFORM_HOLDER } from "./types";

export class StoreConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreConflictError";
  }
}

export class StoreNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreNotFoundError";
  }
}

export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}

export interface CoreStore {
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
  getAccount(
    holderId: string,
    accountCode: AccountCode,
    asset: LedgerAsset
  ): Promise<LedgerAccount | null>;
  ensureAccount(
    holderId: string,
    accountCode: AccountCode,
    asset: LedgerAsset
  ): Promise<LedgerAccount>;
  listAccountsForHolder(holderId: string): Promise<LedgerAccount[]>;
  insertJournal(entry: JournalEntry): Promise<void>;
  applyBalanceDeltas(deltas: { accountId: string; delta: bigint }[]): Promise<void>;
  insertQuote(quote: Quote): Promise<void>;
  getQuote(id: string): Promise<Quote | null>;
  updateQuoteStatus(
    id: string,
    from: QuoteStatus[],
    to: QuoteStatus
  ): Promise<Quote>;
  insertReservation(res: MetalSoftReservation): Promise<void>;
  getReservationByQuote(quoteId: string): Promise<MetalSoftReservation | null>;
  updateReservationStatus(
    id: string,
    from: ReservationStatus[],
    to: ReservationStatus
  ): Promise<MetalSoftReservation>;
  openReservationQuantityUg(asset: AssetCode): Promise<bigint>;
  insertTrade(trade: Trade): Promise<void>;
  getTrade(id: string): Promise<Trade | null>;
  listTradesForUser(userId: string, limit?: number): Promise<Trade[]>;
  updateTrade(id: string, from: TradeStatus[], patch: Partial<Trade>): Promise<Trade>;
  getIdempotency(userId: string, key: string): Promise<IdempotencyRecord | null>;
  putIdempotency(rec: IdempotencyRecord): Promise<void>;
  insertOutbox(event: OutboxEvent): Promise<void>;
  listPendingOutbox(limit: number): Promise<OutboxEvent[]>;
  markOutboxProcessed(id: string): Promise<void>;
  markOutboxFailed(id: string, error: string): Promise<void>;
  getCostBasis(holderId: string, asset: AssetCode): Promise<CostBasis>;
  setCostBasis(row: CostBasis): Promise<void>;
  listSandboxDeposits(userId: string): Promise<
    { id: string; userId: string; irr: bigint; createdAt: string; trackingCode: string }[]
  >;
  insertSandboxDeposit(row: {
    id: string;
    userId: string;
    irr: bigint;
    createdAt: string;
    trackingCode: string;
  }): Promise<void>;
}

const USER_CODES: AccountCode[] = ["USER_AVAILABLE", "USER_RESERVED"];
const PLATFORM_CODES: AccountCode[] = [
  "PLATFORM_AVAILABLE",
  "PLATFORM_RESERVED",
  "PLATFORM_CLEARING",
  "PLATFORM_FEE_REVENUE",
  "PAYMENT_GATEWAY_CLEARING",
  "BANK_SETTLEMENT_CLEARING",
  "PLATFORM_CASH_CONTROL",
  "PLATFORM_OPENING",
  "PLATFORM_RESTRICTED",
];

const IRR_ONLY: AccountCode[] = [
  "PLATFORM_FEE_REVENUE",
  "PAYMENT_GATEWAY_CLEARING",
  "BANK_SETTLEMENT_CLEARING",
  "PLATFORM_CASH_CONTROL",
];

export async function ensurePlatformAccounts(store: CoreStore): Promise<void> {
  for (const code of PLATFORM_CODES) {
    await store.ensureAccount(PLATFORM_HOLDER, code, "IRR");
    if (IRR_ONLY.includes(code)) continue;
    for (const asset of ALL_ASSETS) {
      await store.ensureAccount(PLATFORM_HOLDER, code, asset);
    }
  }
}

export async function ensureUserAccounts(store: CoreStore, userId: string): Promise<void> {
  for (const code of USER_CODES) {
    await store.ensureAccount(userId, code, "IRR");
    for (const asset of ALL_ASSETS) {
      await store.ensureAccount(userId, code, asset);
    }
  }
}

export function newId(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

class Mutex {
  private chain: Promise<void> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}

export class MemoryCoreStore implements CoreStore {
  private mutexes = new Map<string, Mutex>();
  private accounts = new Map<string, LedgerAccount>();
  readonly journals: JournalEntry[] = [];
  private quotes = new Map<string, Quote>();
  private reservations = new Map<string, MetalSoftReservation>();
  private trades = new Map<string, Trade>();
  private idem = new Map<string, IdempotencyRecord>();
  private outbox = new Map<string, OutboxEvent>();
  private cost = new Map<string, CostBasis>();
  private deposits: {
    id: string;
    userId: string;
    irr: bigint;
    createdAt: string;
    trackingCode: string;
  }[] = [];

  private accountKey(holderId: string, code: AccountCode, asset: string) {
    return `${holderId}:${code}:${asset}`;
  }

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    let m = this.mutexes.get(key);
    if (!m) {
      m = new Mutex();
      this.mutexes.set(key, m);
    }
    return m.run(fn);
  }

  async getAccount(
    holderId: string,
    accountCode: AccountCode,
    asset: LedgerAsset
  ): Promise<LedgerAccount | null> {
    return this.accounts.get(this.accountKey(holderId, accountCode, asset)) ?? null;
  }

  async ensureAccount(
    holderId: string,
    accountCode: AccountCode,
    asset: LedgerAsset
  ): Promise<LedgerAccount> {
    const key = this.accountKey(holderId, accountCode, asset);
    const existing = this.accounts.get(key);
    if (existing) return existing;
    const acc: LedgerAccount = {
      id: newId("acc"),
      holderId,
      accountCode,
      asset,
      balance: 0n,
    };
    this.accounts.set(key, acc);
    return acc;
  }

  async listAccountsForHolder(holderId: string): Promise<LedgerAccount[]> {
    return [...this.accounts.values()].filter((a) => a.holderId === holderId);
  }

  async insertJournal(entry: JournalEntry): Promise<void> {
    this.journals.push({
      ...entry,
      lines: entry.lines.map((l) => ({ ...l })),
    });
  }

  async applyBalanceDeltas(deltas: { accountId: string; delta: bigint }[]): Promise<void> {
    const snapshot = new Map<string, bigint>();
    for (const acc of this.accounts.values()) snapshot.set(acc.id, acc.balance);
    try {
      for (const d of deltas) {
        const acc = [...this.accounts.values()].find((a) => a.id === d.accountId);
        if (!acc) throw new StoreNotFoundError(`account ${d.accountId}`);
        const next = acc.balance + d.delta;
        if (next < 0n) {
          throw new InsufficientBalanceError(
            `insufficient ${acc.accountCode} ${acc.asset}`
          );
        }
        acc.balance = next;
      }
    } catch (err) {
      for (const acc of this.accounts.values()) {
        const prev = snapshot.get(acc.id);
        if (prev !== undefined) acc.balance = prev;
      }
      throw err;
    }
  }

  async insertQuote(quote: Quote): Promise<void> {
    this.quotes.set(quote.id, { ...quote });
  }

  async getQuote(id: string): Promise<Quote | null> {
    const q = this.quotes.get(id);
    return q ? { ...q } : null;
  }

  async updateQuoteStatus(id: string, from: QuoteStatus[], to: QuoteStatus): Promise<Quote> {
    const q = this.quotes.get(id);
    if (!q) throw new StoreNotFoundError("quote");
    if (!from.includes(q.status)) {
      throw new StoreConflictError(`quote status ${q.status} not in ${from.join(",")}`);
    }
    const next = { ...q, status: to };
    this.quotes.set(id, next);
    return next;
  }

  async insertReservation(res: MetalSoftReservation): Promise<void> {
    this.reservations.set(res.id, { ...res });
  }

  async getReservationByQuote(quoteId: string): Promise<MetalSoftReservation | null> {
    const r = [...this.reservations.values()].find((x) => x.quoteId === quoteId);
    return r ? { ...r } : null;
  }

  async updateReservationStatus(
    id: string,
    from: ReservationStatus[],
    to: ReservationStatus
  ): Promise<MetalSoftReservation> {
    const r = this.reservations.get(id);
    if (!r) throw new StoreNotFoundError("reservation");
    if (!from.includes(r.status)) {
      throw new StoreConflictError(`reservation status ${r.status}`);
    }
    const next = { ...r, status: to };
    this.reservations.set(id, next);
    return next;
  }

  async openReservationQuantityUg(asset: AssetCode): Promise<bigint> {
    let sum = 0n;
    for (const r of this.reservations.values()) {
      if (r.asset === asset && r.status === "OPEN") sum += r.quantityUg;
    }
    return sum;
  }

  async insertTrade(trade: Trade): Promise<void> {
    this.trades.set(trade.id, { ...trade });
  }

  async getTrade(id: string): Promise<Trade | null> {
    const t = this.trades.get(id);
    return t ? { ...t } : null;
  }

  async listTradesForUser(userId: string, limit = 100): Promise<Trade[]> {
    return [...this.trades.values()]
      .filter((t) => t.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }

  async updateTrade(id: string, from: TradeStatus[], patch: Partial<Trade>): Promise<Trade> {
    const t = this.trades.get(id);
    if (!t) throw new StoreNotFoundError("trade");
    if (!from.includes(t.status)) {
      throw new StoreConflictError(`trade status ${t.status}`);
    }
    const next = { ...t, ...patch };
    this.trades.set(id, next);
    return next;
  }

  async getIdempotency(userId: string, key: string): Promise<IdempotencyRecord | null> {
    return this.idem.get(`${userId}:${key}`) ?? null;
  }

  async putIdempotency(rec: IdempotencyRecord): Promise<void> {
    this.idem.set(`${rec.userId}:${rec.key}`, { ...rec });
  }

  async insertOutbox(event: OutboxEvent): Promise<void> {
    this.outbox.set(event.id, { ...event });
  }

  async listPendingOutbox(limit: number): Promise<OutboxEvent[]> {
    return [...this.outbox.values()].filter((e) => e.status === "PENDING").slice(0, limit);
  }

  async markOutboxProcessed(id: string): Promise<void> {
    const e = this.outbox.get(id);
    if (!e) return;
    this.outbox.set(id, {
      ...e,
      status: "PROCESSED",
      processedAt: new Date().toISOString(),
    });
  }

  async markOutboxFailed(id: string, error: string): Promise<void> {
    const e = this.outbox.get(id);
    if (!e) return;
    this.outbox.set(id, {
      ...e,
      status: "FAILED",
      lastError: error,
      attempts: e.attempts + 1,
    });
  }

  async getCostBasis(holderId: string, asset: AssetCode): Promise<CostBasis> {
    return (
      this.cost.get(`${holderId}:${asset}`) ?? {
        holderId,
        asset,
        quantityUg: 0n,
        costIrr: 0n,
      }
    );
  }

  async setCostBasis(row: CostBasis): Promise<void> {
    this.cost.set(`${row.holderId}:${row.asset}`, { ...row });
  }

  async listSandboxDeposits(userId: string) {
    return this.deposits.filter((d) => d.userId === userId).slice().reverse();
  }

  async insertSandboxDeposit(row: {
    id: string;
    userId: string;
    irr: bigint;
    createdAt: string;
    trackingCode: string;
  }): Promise<void> {
    this.deposits.push({ ...row });
  }
}

/** Credit-normal accounts: credit increases stored balance. */
export function isCreditNormal(code: AccountCode): boolean {
  return (
    code === "USER_AVAILABLE" ||
    code === "USER_RESERVED" ||
    code === "PLATFORM_AVAILABLE" ||
    code === "PLATFORM_RESERVED" ||
    code === "PLATFORM_FEE_REVENUE" ||
    code === "PLATFORM_CASH_CONTROL" ||
    code === "PLATFORM_CLEARING"
  );
}

export function signedDelta(code: AccountCode, line: JournalLine): bigint {
  if (isCreditNormal(code)) return line.credit - line.debit;
  return line.debit - line.credit;
}
