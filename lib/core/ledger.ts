import type { LedgerAsset } from "./assets";
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
} from "./types";

export async function postJournal(
  store: CoreStore,
  entry: JournalEntry
): Promise<void> {
  assertJournalBalanced(entry.lines);
  const deltas: { accountId: string; delta: bigint }[] = [];
  for (const line of entry.lines) {
    const acc = await store.ensureAccount(line.holderId, line.accountCode, line.asset);
    deltas.push({ accountId: acc.id, delta: signedDelta(line.accountCode, line) });
  }
  await store.applyBalanceDeltas(deltas);
  await store.insertJournal(entry);
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

export { PLATFORM_HOLDER };
