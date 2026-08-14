import { randomUUID } from "crypto";
import type { AssetCode, LedgerAsset } from "./assets";
import { ALL_ASSETS } from "./assets";
import { IRR_ONLY, assertAccountPolicy } from "./account-policy";
import type {
  AccountCode,
  CostBasis,
  IdempotencyClaim,
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
import { CoreError, PLATFORM_HOLDER } from "./types";

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
  readonly persistence: "memory" | "postgres";
  inTransaction(): boolean;
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;
  withAdvisoryLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
  /** Convenience: withTransaction + withAdvisoryLock. Prefer explicit calls in new code. */
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
  listAllAccounts(): Promise<LedgerAccount[]>;
  listJournals(): Promise<JournalEntry[]>;
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
  getSettledTradeByQuote(quoteId: string): Promise<Trade | null>;
  listTradesForUser(userId: string, limit?: number): Promise<Trade[]>;
  updateTrade(id: string, from: TradeStatus[], patch: Partial<Trade>): Promise<Trade>;
  getIdempotency(
    userId: string,
    operation: string,
    key: string
  ): Promise<IdempotencyRecord | null>;
  claimIdempotency(rec: IdempotencyRecord): Promise<IdempotencyClaim>;
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
  readonly persistence = "memory" as const;
  private txDepth = 0;
  private txMutex = new Mutex();
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

  inTransaction() {
    return this.txDepth > 0;
  }

  private snapshot() {
    return {
      accounts: new Map(
        [...this.accounts.entries()].map(([k, v]) => [k, { ...v }])
      ),
      journals: this.journals.map((j) => ({
        ...j,
        lines: j.lines.map((l) => ({ ...l })),
      })),
      quotes: new Map([...this.quotes.entries()].map(([k, v]) => [k, { ...v }])),
      reservations: new Map(
        [...this.reservations.entries()].map(([k, v]) => [k, { ...v }])
      ),
      trades: new Map([...this.trades.entries()].map(([k, v]) => [k, { ...v }])),
      idem: new Map([...this.idem.entries()].map(([k, v]) => [k, { ...v }])),
      outbox: new Map([...this.outbox.entries()].map(([k, v]) => [k, { ...v }])),
      cost: new Map([...this.cost.entries()].map(([k, v]) => [k, { ...v }])),
      deposits: this.deposits.map((d) => ({ ...d })),
    };
  }

  private restore(s: ReturnType<MemoryCoreStore["snapshot"]>) {
    this.accounts = s.accounts;
    this.journals.length = 0;
    this.journals.push(...s.journals);
    this.quotes = s.quotes;
    this.reservations = s.reservations;
    this.trades = s.trades;
    this.idem = s.idem;
    this.outbox = s.outbox;
    this.cost = s.cost;
    this.deposits = s.deposits;
  }

  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.txDepth > 0) {
      this.txDepth += 1;
      try {
        return await fn();
      } finally {
        this.txDepth -= 1;
      }
    }
    return this.txMutex.run(async () => {
      const snap = this.snapshot();
      this.txDepth = 1;
      try {
        const result = await fn();
        this.txDepth = 0;
        return result;
      } catch (err) {
        this.restore(snap);
        this.txDepth = 0;
        throw err;
      }
    });
  }

  async withAdvisoryLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    let m = this.mutexes.get(key);
    if (!m) {
      m = new Mutex();
      this.mutexes.set(key, m);
    }
    return m.run(fn);
  }

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return this.withTransaction(() => this.withAdvisoryLock(key, fn));
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
    assertAccountPolicy(holderId, accountCode, asset, PLATFORM_HOLDER);
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

  async listAllAccounts(): Promise<LedgerAccount[]> {
    return [...this.accounts.values()].map((a) => ({ ...a }));
  }

  async listJournals(): Promise<JournalEntry[]> {
    return this.journals.map((j) => ({
      ...j,
      lines: j.lines.map((l) => ({ ...l })),
    }));
  }

  async insertJournal(entry: JournalEntry): Promise<void> {
    for (const l of entry.lines) {
      if (!((l.debit > 0n && l.credit === 0n) || (l.credit > 0n && l.debit === 0n))) {
        throw new CoreError("invalid_journal", "exactly one of debit/credit must be positive");
      }
    }
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
    const dup = [...this.reservations.values()].find((x) => x.quoteId === res.quoteId);
    if (dup) throw new StoreConflictError("one reservation per quote");
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
    const trackingDup = [...this.trades.values()].find(
      (t) => t.trackingCode === trade.trackingCode
    );
    if (trackingDup) throw new StoreConflictError("tracking_code must be unique");
    if (trade.status === "SETTLED") {
      const existing = await this.getSettledTradeByQuote(trade.quoteId);
      if (existing) throw new StoreConflictError("one settled trade per quote");
    }
    this.trades.set(trade.id, { ...trade });
  }

  async getTrade(id: string): Promise<Trade | null> {
    const t = this.trades.get(id);
    return t ? { ...t } : null;
  }

  async getSettledTradeByQuote(quoteId: string): Promise<Trade | null> {
    return (
      [...this.trades.values()].find((t) => t.quoteId === quoteId && t.status === "SETTLED") ??
      null
    );
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
    if (next.status === "SETTLED") {
      const existing = [...this.trades.values()].find(
        (x) => x.quoteId === next.quoteId && x.status === "SETTLED" && x.id !== next.id
      );
      if (existing) throw new StoreConflictError("one settled trade per quote");
    }
    this.trades.set(id, next);
    return next;
  }

  private idemKey(userId: string, operation: string, key: string) {
    return `${userId}:${operation}:${key}`;
  }

  async getIdempotency(
    userId: string,
    operation: string,
    key: string
  ): Promise<IdempotencyRecord | null> {
    return this.idem.get(this.idemKey(userId, operation, key)) ?? null;
  }

  async claimIdempotency(rec: IdempotencyRecord): Promise<IdempotencyClaim> {
    const k = this.idemKey(rec.userId, rec.operation, rec.key);
    const existing = this.idem.get(k);
    if (existing) {
      if (existing.requestHash !== rec.requestHash) {
        return { kind: "conflict", record: existing };
      }
      if (existing.status === "COMPLETED") {
        return { kind: "replay", record: existing };
      }
      return { kind: "in_progress", record: existing };
    }
    this.idem.set(k, { ...rec, status: "IN_PROGRESS", responseJson: null });
    return { kind: "claimed" };
  }

  async putIdempotency(rec: IdempotencyRecord): Promise<void> {
    this.idem.set(this.idemKey(rec.userId, rec.operation, rec.key), { ...rec });
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
