/**
 * Journal posting invariant:
 *
 * Balance-cache mutation (`applyBalanceDeltas`) and the immutable
 * `core_journals` / `core_journal_lines` insert MUST happen in the SAME
 * database transaction. A caller must never observe a posted journal without
 * matching balance projection, or a changed balance without a journal.
 *
 * If `postJournal()` is invoked outside an open transaction, it opens one
 * via `store.withTransaction`. Nested calls join the existing transaction.
 */
import type { LedgerAsset } from "./assets";
import { assertOpeningPostingAllowed } from "./account-policy";
import {
  ensurePlatformAccounts,
  ensureUserAccounts,
  signedDelta,
  type CoreStore,
} from "./store";
import {
  assertJournalBalanced,
  CoreError,
  PLATFORM_HOLDER,
  type AccountCode,
  type JournalEntry,
  type JournalLine,
  type LedgerAccount,
} from "./types";

export type LedgerMismatch = {
  holderId: string;
  accountCode: AccountCode;
  asset: LedgerAsset;
  cached: bigint;
  derived: bigint;
};

export type LedgerReconcileResult = {
  ok: boolean;
  mismatches: LedgerMismatch[];
};

export async function postJournal(store: CoreStore, entry: JournalEntry): Promise<void> {
  assertJournalBalanced(entry.lines);
  assertOpeningPostingAllowed(entry);

  const run = async () => {
    const deltas: { accountId: string; delta: bigint }[] = [];
    for (const journalLine of entry.lines) {
      const acc = await store.ensureAccount(
        journalLine.holderId,
        journalLine.accountCode,
        journalLine.asset
      );
      deltas.push({
        accountId: acc.id,
        delta: signedDelta(journalLine.accountCode, journalLine),
      });
    }
    // Same transaction: projection then immutable journal (or vice versa).
    // Either order is rolled back together. Journal-first would leave an
    // immutable row if deltas then failed without a tx — so we require a tx
    // and apply deltas then journal so a failed journal cannot leave a
    // mutated cache either.
    await store.applyBalanceDeltas(deltas);
    await store.insertJournal(entry);
  };

  if (store.inTransaction()) return run();
  return store.withTransaction(run);
}

export function line(
  accountCode: AccountCode,
  holderId: string,
  asset: LedgerAsset,
  debit: bigint,
  credit: bigint
): JournalLine {
  return { accountCode, holderId, asset, debit, credit };
}

export async function bootstrapChart(store: CoreStore, userId?: string) {
  await ensurePlatformAccounts(store);
  if (userId) await ensureUserAccounts(store, userId);
}

export async function getBalance(
  store: CoreStore,
  holderId: string,
  code: AccountCode,
  asset: LedgerAsset
): Promise<bigint> {
  const acc = await store.getAccount(holderId, code, asset);
  return acc?.balance ?? 0n;
}

export async function requireBalance(
  store: CoreStore,
  holderId: string,
  code: AccountCode,
  asset: LedgerAsset,
  need: bigint,
  message: string
) {
  const bal = await getBalance(store, holderId, code, asset);
  if (bal < need) throw new CoreError("insufficient_funds", message, 409);
  return bal;
}

export function derivedBalanceFromJournals(
  account: Pick<LedgerAccount, "holderId" | "accountCode" | "asset">,
  journals: JournalEntry[]
): bigint {
  let bal = 0n;
  for (const entry of journals) {
    for (const journalLine of entry.lines) {
      if (
        journalLine.holderId === account.holderId &&
        journalLine.accountCode === account.accountCode &&
        journalLine.asset === account.asset
      ) {
        bal += signedDelta(account.accountCode, journalLine);
      }
    }
  }
  return bal;
}

/** Cached `core_ledger_accounts.balance` vs immutable journal history. */
export async function recomputeAccountBalanceFromJournal(
  store: CoreStore,
  holderId: string,
  accountCode: AccountCode,
  asset: LedgerAsset
): Promise<{ cached: bigint; derived: bigint; matches: boolean }> {
  const acc = await store.getAccount(holderId, accountCode, asset);
  const journals = await store.listJournals();
  const derived = derivedBalanceFromJournals(
    acc ?? { holderId, accountCode, asset },
    journals
  );
  const cached = acc?.balance ?? 0n;
  return { cached, derived, matches: cached === derived };
}

export async function reconcileAllLedgerBalances(
  store: CoreStore
): Promise<LedgerReconcileResult> {
  const [accounts, journals] = await Promise.all([
    store.listAllAccounts(),
    store.listJournals(),
  ]);
  const mismatches: LedgerMismatch[] = [];
  for (const acc of accounts) {
    const derived = derivedBalanceFromJournals(acc, journals);
    if (derived !== acc.balance) {
      mismatches.push({
        holderId: acc.holderId,
        accountCode: acc.accountCode,
        asset: acc.asset,
        cached: acc.balance,
        derived,
      });
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

export { PLATFORM_HOLDER };
