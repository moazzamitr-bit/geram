import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { CORE_SCHEMA_SQL } from "@/lib/core/schema";
import { PostgresCoreStore } from "@/lib/core/pg-store";
import { tomanToIrr } from "@/lib/core/money";
import { makePgCore } from "./helpers";

describe("PostgreSQL ledger integration (PGlite)", () => {
  it("persists buy/sell journals and balances", async () => {
    const db = new PGlite();
    await db.exec(CORE_SCHEMA_SQL);
    const store = new PostgresCoreStore({
      query: async (sql, params = []) => {
        const res = await db.query(sql, params);
        return { rows: res.rows as Record<string, unknown>[] };
      },
      exec: async (sql, params = []) => {
        await db.query(sql, params);
      },
    });
    const core = makePgCore(store);
    const user = "pg-user";
    await core.sandboxDeposit(user, tomanToIrr(8_000_000), "dep");
    const q = await core.issueQuote({
      userId: user,
      asset: "GOLD",
      side: "BUY",
      inputMode: "RIAL_AMOUNT",
      requestedIrr: tomanToIrr(2_000_000),
    });
    const trade = await core.executeTrade({
      userId: user,
      quoteId: q.id,
      idempotencyKey: "pg-buy",
    });
    expect(trade.status).toBe("SETTLED");
    const wallet = await core.wallet(user);
    expect(wallet.metals.GOLD.availableUg).toBe(q.weightUg);
    const { rows } = await db.query("select count(*)::int as n from core_journals");
    expect(Number((rows[0] as { n: number }).n)).toBeGreaterThan(1);
  });

  it("rejects journal UPDATE and DELETE", async () => {
    const db = new PGlite();
    await db.exec(CORE_SCHEMA_SQL);
    await db.exec("begin");
    await db.exec(`
      insert into core_journals (id, created_at, reason, ref_type, ref_id)
      values ('j1', now(), 't', 'SYSTEM_SEED', 'x');
      insert into core_journal_lines (journal_id, account_code, holder_id, asset, debit, credit)
      values
        ('j1', 'PLATFORM_OPENING', 'p', 'GOLD', 10, 0),
        ('j1', 'PLATFORM_AVAILABLE', 'p', 'GOLD', 0, 10);
    `);
    await db.exec("commit");
    await expect(db.exec(`update core_journals set reason='hack' where id='j1'`)).rejects.toThrow();
    await expect(db.exec(`delete from core_journals where id='j1'`)).rejects.toThrow();
    await expect(
      db.exec(`update core_journal_lines set debit=1 where journal_id='j1' and debit=10`)
    ).rejects.toThrow();
    await expect(
      db.exec(`delete from core_journal_lines where journal_id='j1'`)
    ).rejects.toThrow();
  });

  it("rejects 0/0 and debit+credit journal lines", async () => {
    const db = new PGlite();
    await db.exec(CORE_SCHEMA_SQL);
    await db.exec(`
      insert into core_journals (id, created_at, reason, ref_type, ref_id)
      values ('j0', now(), 't', 'test', 'x');
    `);
    await expect(
      db.exec(`
        insert into core_journal_lines (journal_id, account_code, holder_id, asset, debit, credit)
        values ('j0', 'USER_AVAILABLE', 'u', 'IRR', 0, 0);
      `)
    ).rejects.toThrow();
    await expect(
      db.exec(`
        insert into core_journal_lines (journal_id, account_code, holder_id, asset, debit, credit)
        values ('j0', 'USER_AVAILABLE', 'u', 'IRR', 5, 5);
      `)
    ).rejects.toThrow();
  });

  it("rejects unbalanced IRR, GOLD, and cross-asset fake balance at commit", async () => {
    const db = new PGlite();
    await db.exec(CORE_SCHEMA_SQL);

    const persistUnbalanced = async (id: string, sqlLines: string) => {
      try {
        await db.exec("begin");
        await db.exec(`
          insert into core_journals (id, created_at, reason, ref_type, ref_id)
          values ('${id}', now(), 't', 'test', 'x');
          ${sqlLines}
        `);
        await db.exec("commit");
      } catch (err) {
        await db.exec("rollback").catch(() => undefined);
        throw err;
      }
    };

    await expect(
      persistUnbalanced(
        "unb-irr",
        `insert into core_journal_lines (journal_id, account_code, holder_id, asset, debit, credit) values
          ('unb-irr', 'USER_AVAILABLE', 'u', 'IRR', 0, 10),
          ('unb-irr', 'PAYMENT_GATEWAY_CLEARING', 'p', 'IRR', 7, 0);`
      )
    ).rejects.toThrow();

    await expect(
      persistUnbalanced(
        "unb-gold",
        `insert into core_journal_lines (journal_id, account_code, holder_id, asset, debit, credit) values
          ('unb-gold', 'USER_AVAILABLE', 'u', 'GOLD', 0, 10),
          ('unb-gold', 'PLATFORM_AVAILABLE', 'p', 'GOLD', 3, 0);`
      )
    ).rejects.toThrow();

    await expect(
      persistUnbalanced(
        "cross",
        `insert into core_journal_lines (journal_id, account_code, holder_id, asset, debit, credit) values
          ('cross', 'USER_AVAILABLE', 'u', 'GOLD', 10, 0),
          ('cross', 'USER_AVAILABLE', 'u', 'IRR', 0, 10);`
      )
    ).rejects.toThrow();
  });

  it("blocks sandbox deposit in PRODUCTION", async () => {
    const db = new PGlite();
    await db.exec(CORE_SCHEMA_SQL);
    const store = new PostgresCoreStore({
      query: async (sql, params = []) => {
        const res = await db.query(sql, params);
        return { rows: res.rows as Record<string, unknown>[] };
      },
      exec: async (sql, params = []) => {
        await db.query(sql, params);
      },
    });
    const core = makePgCore(store, { mode: "PRODUCTION" });
    await expect(core.sandboxDeposit("u", 100n, "k")).rejects.toMatchObject({
      code: "sandbox_deposit_blocked",
    });
  });

  it("rejects a second SETTLED trade for the same quote at the database", async () => {
    const db = new PGlite();
    await db.exec(CORE_SCHEMA_SQL);
    await db.exec(`
      insert into core_quotes (
        id, user_id, asset, side, input_mode, requested_irr, requested_weight_ug,
        reference_price_irr_per_gram, execution_price_irr_per_gram, gross_irr, fee_irr, net_irr,
        weight_ug, fee_snapshot_json, spread_snapshot_json, price_source_snapshot_json,
        created_at, expires_at, status
      ) values (
        'q1', 'u', 'GOLD', 'BUY', 'RIAL_AMOUNT', 100, null,
        1, 1, 100, 1, 99, 1, '{}', '{}', '{}', now(), now(), 'USED'
      );
      insert into core_trades (
        id, user_id, quote_id, asset, side, status, weight_ug, gross_irr, fee_irr, net_irr,
        idempotency_key, created_at, tracking_code
      ) values (
        't1', 'u', 'q1', 'GOLD', 'BUY', 'SETTLED', 1, 100, 1, 99,
        'k1', now(), 'GRM-1'
      );
    `);
    await expect(
      db.exec(`
        insert into core_trades (
          id, user_id, quote_id, asset, side, status, weight_ug, gross_irr, fee_irr, net_irr,
          idempotency_key, created_at, tracking_code
        ) values (
          't2', 'u', 'q1', 'GOLD', 'BUY', 'SETTLED', 1, 100, 1, 99,
          'k2', now(), 'GRM-2'
        );
      `)
    ).rejects.toThrow();
  });
});
