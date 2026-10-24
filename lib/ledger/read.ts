import { createServiceClient } from "@/lib/supabase/admin";
import {
  avgBuyFromCostRows,
  parseLedgerBalance,
  payloadFromView,
  projectHolderLedger,
  USER_BALANCE_ASSETS,
  USER_BALANCE_CODES,
  type BalancePayload,
  type HolderLedgerView,
  type LedgerBalanceRow,
} from "@/lib/ledger/display";

type AccountQueryRow = {
  holder_id: string;
  account_code: string;
  asset: string;
  balance: string | number | null;
};

function mapAccount(row: AccountQueryRow): LedgerBalanceRow {
  return {
    holderId: String(row.holder_id),
    accountCode: String(row.account_code),
    asset: String(row.asset),
    balance: parseLedgerBalance(row.balance),
  };
}

/**
 * Service-role read of user balance accounts. Callers must pass a holder id
 * they already authenticated — this function does not trust a client-supplied id
 * on its own. Returns no `wallets` rows.
 */
export async function readLedgerAccountRows(filter?: { holderId: string }): Promise<
  { ok: true; rows: LedgerBalanceRow[] } | { ok: false; error: string }
> {
  try {
    const sb = createServiceClient();
    let query = sb
      .from("core_ledger_accounts")
      .select("holder_id, account_code, asset, balance")
      .in("account_code", [...USER_BALANCE_CODES])
      .in("asset", [...USER_BALANCE_ASSETS]);
    if (filter?.holderId) query = query.eq("holder_id", filter.holderId);
    const { data, error } = await query.limit(5000);
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: ((data ?? []) as AccountQueryRow[]).map(mapAccount) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "ledger_unavailable" };
  }
}

async function readAvgBuy(holderId: string) {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("core_cost_basis")
      .select("asset, quantity_ug, cost_irr")
      .eq("holder_id", holderId);
    if (error || !data) return avgBuyFromCostRows([]);
    return avgBuyFromCostRows(
      data.map((row) => ({
        asset: String(row.asset),
        quantityUg: parseLedgerBalance(row.quantity_ug as string | number | null),
        costIrr: parseLedgerBalance(row.cost_irr as string | number | null),
      }))
    );
  } catch {
    return avgBuyFromCostRows([]);
  }
}

export async function readHolderBalancePayload(holderId: string): Promise<
  { ok: true; body: BalancePayload } | { ok: false; error: string }
> {
  const loaded = await readLedgerAccountRows({ holderId });
  if (!loaded.ok) return loaded;
  const avg = await readAvgBuy(holderId);
  return { ok: true, body: payloadFromView(projectHolderLedger(holderId, loaded.rows), avg) };
}

export async function readHolderLedgerView(holderId: string): Promise<
  { ok: true; view: HolderLedgerView } | { ok: false; error: string }
> {
  const loaded = await readLedgerAccountRows({ holderId });
  if (!loaded.ok) return loaded;
  return { ok: true, view: projectHolderLedger(holderId, loaded.rows) };
}

export async function listCustomerLedgerViews(): Promise<
  { ok: true; views: HolderLedgerView[] } | { ok: false; error: string }
> {
  const loaded = await readLedgerAccountRows();
  if (!loaded.ok) return loaded;
  const ids = [...new Set(loaded.rows.map((row) => row.holderId))];
  const views = ids
    .map((holderId) => projectHolderLedger(holderId, loaded.rows))
    .sort((a, b) => {
      if (a.availableIrr === b.availableIrr) return a.holderId.localeCompare(b.holderId);
      return a.availableIrr > b.availableIrr ? -1 : 1;
    });
  return { ok: true, views };
}
