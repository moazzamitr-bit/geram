import { AsyncLocalStorage } from "async_hooks";
import type { AssetCode, LedgerAsset } from "./assets";
import { CORE_SCHEMA_SQL } from "./schema";
import {
  newId,
  StoreConflictError,
  StoreNotFoundError,
  InsufficientBalanceError,
  type CoreStore,
} from "./store";
import type {
  AccountCode,
  CostBasis,
  IdempotencyRecord,
  JournalEntry,
  LedgerAccount,
  MetalSoftReservation,
  OutboxEvent,
  Quote,
  QuoteStatus,
  ReservationStatus,
  Trade,
  TradeStatus,
} from "./types";

export type SqlQueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
export type SqlExecFn = (sql: string, params?: unknown[]) => Promise<void>;

export type SqlSession = {
  query: SqlQueryFn;
  exec: SqlExecFn;
};

const sqlAls = new AsyncLocalStorage<SqlSession>();

function big(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") return BigInt(v);
  if (v == null) return 0n;
  return BigInt(String(v));
}

function str(v: unknown) {
  return String(v);
}

function mapAccount(row: Record<string, unknown>): LedgerAccount {
  return {
    id: str(row.id),
    holderId: str(row.holder_id),
    accountCode: str(row.account_code) as AccountCode,
    asset: str(row.asset) as LedgerAsset,
    balance: big(row.balance),
  };
}

function mapQuote(row: Record<string, unknown>): Quote {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    asset: str(row.asset) as Quote["asset"],
    side: str(row.side) as Quote["side"],
    inputMode: str(row.input_mode) as Quote["inputMode"],
    requestedIrr: big(row.requested_irr),
    requestedWeightUg: big(row.requested_weight_ug),
    referencePriceIrrPerGram: big(row.reference_price_irr_per_gram),
    executionPriceIrrPerGram: big(row.execution_price_irr_per_gram),
    grossIrr: big(row.gross_irr),
    feeIrr: big(row.fee_irr),
    netIrr: big(row.net_irr),
    weightUg: big(row.weight_ug),
    feeSnapshotJson: str(row.fee_snapshot_json),
    spreadSnapshotJson: str(row.spread_snapshot_json),
    priceSourceSnapshotJson: str(row.price_source_snapshot_json),
    createdAt: new Date(str(row.created_at)).toISOString(),
    expiresAt: new Date(str(row.expires_at)).toISOString(),
    status: str(row.status) as QuoteStatus,
  };
}

function mapTrade(row: Record<string, unknown>): Trade {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    quoteId: str(row.quote_id),
    asset: str(row.asset) as Trade["asset"],
    side: str(row.side) as Trade["side"],
    status: str(row.status) as TradeStatus,
    weightUg: big(row.weight_ug),
    grossIrr: big(row.gross_irr),
    feeIrr: big(row.fee_irr),
    netIrr: big(row.net_irr),
    idempotencyKey: str(row.idempotency_key),
    createdAt: new Date(str(row.created_at)).toISOString(),
    trackingCode: str(row.tracking_code),
  };
}

export class PostgresCoreStore implements CoreStore {
  constructor(
    private readonly base: SqlSession,
    private readonly checkout?: () => Promise<{
      session: SqlSession;
      commit: () => Promise<void>;
      rollback: () => Promise<void>;
      release: () => void;
    }>
  ) {}

  private sql(): SqlSession {
    return sqlAls.getStore() ?? this.base;
  }

  static async applySchema(sql: SqlSession) {
    await sql.exec(CORE_SCHEMA_SQL);
  }

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const current = sqlAls.getStore();
    if (current) {
      await current.query("select pg_advisory_xact_lock(hashtext($1::text))", [key]);
      return fn();
    }
    if (this.checkout) {
      const tx = await this.checkout();
      try {
        return await sqlAls.run(tx.session, async () => {
          await tx.session.query("select pg_advisory_xact_lock(hashtext($1::text))", [key]);
          const result = await fn();
          await tx.commit();
          return result;
        });
      } catch (err) {
        await tx.rollback();
        throw err;
      } finally {
        tx.release();
      }
    }
    await this.base.query("select pg_advisory_lock(hashtext($1::text))", [key]);
    try {
      return await fn();
    } finally {
      await this.base.query("select pg_advisory_unlock(hashtext($1::text))", [key]);
    }
  }

  async getAccount(holderId: string, accountCode: AccountCode, asset: LedgerAsset) {
    const { rows } = await this.sql().query(
      `select * from core_ledger_accounts where holder_id=$1 and account_code=$2 and asset=$3`,
      [holderId, accountCode, asset]
    );
    return rows[0] ? mapAccount(rows[0]) : null;
  }

  async ensureAccount(holderId: string, accountCode: AccountCode, asset: LedgerAsset) {
    const existing = await this.getAccount(holderId, accountCode, asset);
    if (existing) return existing;
    const id = newId("acc");
    await this.sql().exec(
      `insert into core_ledger_accounts (id, holder_id, account_code, asset, balance)
       values ($1,$2,$3,$4,0)
       on conflict (holder_id, account_code, asset) do nothing`,
      [id, holderId, accountCode, asset]
    );
    const acc = await this.getAccount(holderId, accountCode, asset);
    if (!acc) throw new StoreNotFoundError("account insert failed");
    return acc;
  }

  async listAccountsForHolder(holderId: string) {
    const { rows } = await this.sql().query(
      `select * from core_ledger_accounts where holder_id=$1`,
      [holderId]
    );
    return rows.map(mapAccount);
  }

  async insertJournal(entry: JournalEntry) {
    await this.sql().exec(
      `insert into core_journals (id, created_at, reason, ref_type, ref_id) values ($1,$2,$3,$4,$5)`,
      [entry.id, entry.createdAt, entry.reason, entry.refType, entry.refId]
    );
    for (const line of entry.lines) {
      await this.sql().exec(
        `insert into core_journal_lines (journal_id, account_code, holder_id, asset, debit, credit)
         values ($1,$2,$3,$4,$5,$6)`,
        [entry.id, line.accountCode, line.holderId, line.asset, line.debit.toString(), line.credit.toString()]
      );
    }
  }

  async applyBalanceDeltas(deltas: { accountId: string; delta: bigint }[]) {
    for (const d of deltas) {
      const { rows } = await this.sql().query(
        `update core_ledger_accounts set balance = balance + $2::bigint
         where id=$1 and balance + $2::bigint >= 0
         returning id, balance`,
        [d.accountId, d.delta.toString()]
      );
      if (!rows[0]) {
        throw new InsufficientBalanceError(`insufficient funds on ${d.accountId}`);
      }
    }
  }

  async insertQuote(quote: Quote) {
    await this.sql().exec(
      `insert into core_quotes (
        id, user_id, asset, side, input_mode, requested_irr, requested_weight_ug,
        reference_price_irr_per_gram, execution_price_irr_per_gram, gross_irr, fee_irr, net_irr,
        weight_ug, fee_snapshot_json, spread_snapshot_json, price_source_snapshot_json,
        created_at, expires_at, status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        quote.id,
        quote.userId,
        quote.asset,
        quote.side,
        quote.inputMode,
        quote.requestedIrr.toString(),
        quote.requestedWeightUg.toString(),
        quote.referencePriceIrrPerGram.toString(),
        quote.executionPriceIrrPerGram.toString(),
        quote.grossIrr.toString(),
        quote.feeIrr.toString(),
        quote.netIrr.toString(),
        quote.weightUg.toString(),
        quote.feeSnapshotJson,
        quote.spreadSnapshotJson,
        quote.priceSourceSnapshotJson,
        quote.createdAt,
        quote.expiresAt,
        quote.status,
      ]
    );
  }

  async getQuote(id: string) {
    const { rows } = await this.sql().query(`select * from core_quotes where id=$1`, [id]);
    return rows[0] ? mapQuote(rows[0]) : null;
  }

  async updateQuoteStatus(id: string, from: QuoteStatus[], to: QuoteStatus) {
    const placeholders = from.map((_, i) => `$${i + 3}`).join(",");
    const { rows } = await this.sql().query(
      `update core_quotes set status=$2 where id=$1 and status in (${placeholders}) returning *`,
      [id, to, ...from]
    );
    if (!rows[0]) throw new StoreConflictError("quote status conflict");
    return mapQuote(rows[0]);
  }

  async insertReservation(res: MetalSoftReservation) {
    await this.sql().exec(
      `insert into core_reservations (id, quote_id, asset, quantity_ug, status, created_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [res.id, res.quoteId, res.asset, res.quantityUg.toString(), res.status, res.createdAt]
    );
  }

  async getReservationByQuote(quoteId: string) {
    const { rows } = await this.sql().query(
      `select * from core_reservations where quote_id=$1`,
      [quoteId]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: str(r.id),
      quoteId: str(r.quote_id),
      asset: str(r.asset) as AssetCode,
      quantityUg: big(r.quantity_ug),
      status: str(r.status) as ReservationStatus,
      createdAt: new Date(str(r.created_at)).toISOString(),
    };
  }

  async updateReservationStatus(id: string, from: ReservationStatus[], to: ReservationStatus) {
    const placeholders = from.map((_, i) => `$${i + 3}`).join(",");
    const { rows } = await this.sql().query(
      `update core_reservations set status=$2 where id=$1 and status in (${placeholders}) returning *`,
      [id, to, ...from]
    );
    if (!rows[0]) throw new StoreConflictError("reservation status conflict");
    const r = rows[0];
    return {
      id: str(r.id),
      quoteId: str(r.quote_id),
      asset: str(r.asset) as AssetCode,
      quantityUg: big(r.quantity_ug),
      status: str(r.status) as ReservationStatus,
      createdAt: new Date(str(r.created_at)).toISOString(),
    };
  }

  async openReservationQuantityUg(asset: AssetCode) {
    const { rows } = await this.sql().query(
      `select coalesce(sum(quantity_ug),0) as q from core_reservations where asset=$1 and status='OPEN'`,
      [asset]
    );
    return big(rows[0]?.q);
  }

  async insertTrade(trade: Trade) {
    await this.sql().exec(
      `insert into core_trades (
        id, user_id, quote_id, asset, side, status, weight_ug, gross_irr, fee_irr, net_irr,
        idempotency_key, created_at, tracking_code
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        trade.id,
        trade.userId,
        trade.quoteId,
        trade.asset,
        trade.side,
        trade.status,
        trade.weightUg.toString(),
        trade.grossIrr.toString(),
        trade.feeIrr.toString(),
        trade.netIrr.toString(),
        trade.idempotencyKey,
        trade.createdAt,
        trade.trackingCode,
      ]
    );
  }

  async getTrade(id: string) {
    const { rows } = await this.sql().query(`select * from core_trades where id=$1`, [id]);
    return rows[0] ? mapTrade(rows[0]) : null;
  }

  async listTradesForUser(userId: string, limit = 100) {
    const { rows } = await this.sql().query(
      `select * from core_trades where user_id=$1 order by created_at desc limit $2`,
      [userId, limit]
    );
    return rows.map(mapTrade);
  }

  async updateTrade(id: string, from: TradeStatus[], patch: Partial<Trade>) {
    const status = patch.status;
    if (!status) throw new StoreConflictError("trade patch requires status");
    const placeholders = from.map((_, i) => `$${i + 3}`).join(",");
    const { rows } = await this.sql().query(
      `update core_trades set status=$2 where id=$1 and status in (${placeholders}) returning *`,
      [id, status, ...from]
    );
    if (!rows[0]) throw new StoreConflictError("trade status conflict");
    return mapTrade(rows[0]);
  }

  async getIdempotency(userId: string, key: string) {
    const { rows } = await this.sql().query(
      `select * from core_idempotency where user_id=$1 and key=$2`,
      [userId, key]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      key: str(r.key),
      userId: str(r.user_id),
      method: str(r.method),
      path: str(r.path),
      requestHash: str(r.request_hash),
      responseJson: r.response_json == null ? null : str(r.response_json),
      status: str(r.status) as IdempotencyRecord["status"],
      createdAt: new Date(str(r.created_at)).toISOString(),
    };
  }

  async putIdempotency(rec: IdempotencyRecord) {
    await this.sql().exec(
      `insert into core_idempotency (user_id, key, method, path, request_hash, response_json, status, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (user_id, key) do update set
         response_json=excluded.response_json, status=excluded.status`,
      [
        rec.userId,
        rec.key,
        rec.method,
        rec.path,
        rec.requestHash,
        rec.responseJson,
        rec.status,
        rec.createdAt,
      ]
    );
  }

  async insertOutbox(event: OutboxEvent) {
    await this.sql().exec(
      `insert into core_outbox (id, topic, payload_json, created_at, processed_at, attempts, status, last_error)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        event.id,
        event.topic,
        event.payloadJson,
        event.createdAt,
        event.processedAt,
        event.attempts,
        event.status,
        event.lastError,
      ]
    );
  }

  async listPendingOutbox(limit: number) {
    const { rows } = await this.sql().query(
      `select * from core_outbox where status='PENDING' order by created_at asc limit $1`,
      [limit]
    );
    return rows.map((r) => ({
      id: str(r.id),
      topic: str(r.topic),
      payloadJson: str(r.payload_json),
      createdAt: new Date(str(r.created_at)).toISOString(),
      processedAt: r.processed_at ? new Date(str(r.processed_at)).toISOString() : null,
      attempts: Number(r.attempts ?? 0),
      status: str(r.status) as OutboxEvent["status"],
      lastError: r.last_error == null ? null : str(r.last_error),
    }));
  }

  async markOutboxProcessed(id: string) {
    await this.sql().exec(
      `update core_outbox set status='PROCESSED', processed_at=now() where id=$1`,
      [id]
    );
  }

  async markOutboxFailed(id: string, error: string) {
    await this.sql().exec(
      `update core_outbox set status='FAILED', last_error=$2, attempts=attempts+1 where id=$1`,
      [id, error]
    );
  }

  async getCostBasis(holderId: string, asset: AssetCode): Promise<CostBasis> {
    const { rows } = await this.sql().query(
      `select * from core_cost_basis where holder_id=$1 and asset=$2`,
      [holderId, asset]
    );
    if (!rows[0]) return { holderId, asset, quantityUg: 0n, costIrr: 0n };
    return {
      holderId,
      asset,
      quantityUg: big(rows[0].quantity_ug),
      costIrr: big(rows[0].cost_irr),
    };
  }

  async setCostBasis(row: CostBasis) {
    await this.sql().exec(
      `insert into core_cost_basis (holder_id, asset, quantity_ug, cost_irr)
       values ($1,$2,$3,$4)
       on conflict (holder_id, asset) do update set quantity_ug=excluded.quantity_ug, cost_irr=excluded.cost_irr`,
      [row.holderId, row.asset, row.quantityUg.toString(), row.costIrr.toString()]
    );
  }

  async listSandboxDeposits(userId: string) {
    const { rows } = await this.sql().query(
      `select * from core_sandbox_deposits where user_id=$1 order by created_at desc`,
      [userId]
    );
    return rows.map((r) => ({
      id: str(r.id),
      userId: str(r.user_id),
      irr: big(r.irr),
      createdAt: new Date(str(r.created_at)).toISOString(),
      trackingCode: str(r.tracking_code),
    }));
  }

  async insertSandboxDeposit(row: {
    id: string;
    userId: string;
    irr: bigint;
    createdAt: string;
    trackingCode: string;
  }) {
    await this.sql().exec(
      `insert into core_sandbox_deposits (id, user_id, irr, created_at, tracking_code)
       values ($1,$2,$3,$4,$5)`,
      [row.id, row.userId, row.irr.toString(), row.createdAt, row.trackingCode]
    );
  }
}
