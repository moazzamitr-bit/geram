import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/db/types";
import { irrToSafeTomanNumber, ugToSafeMgNumber } from "@/lib/core/money";
import { PLATFORM_HOLDER } from "@/lib/core/types";

async function adminDb() {
  if (!isSupabaseConfigured()) return null;
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

export type AdminProfile = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
};

/** Shape the admin lists already render: trades and opening journals, in toman and milligrams. */
export type AdminActivity = {
  id: string;
  tracking_code: string;
  type: string;
  instrument: string | null;
  gold_mg: number;
  amount_toman: number;
  fee_toman: number;
  status: string;
  created_at: string;
  user_id: string;
  payment_ref: string | null;
  note: string | null;
  profiles: AdminProfile | null;
};

function asBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  const raw = String(value ?? "0").trim().split(".")[0]?.replace(/[^\d-]/g, "") ?? "0";
  if (!raw || raw === "-") return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

function safeToman(amount: bigint): number {
  try {
    return irrToSafeTomanNumber(amount);
  } catch {
    return 0;
  }
}

function safeMg(weight: bigint): number {
  try {
    return ugToSafeMgNumber(weight);
  } catch {
    return 0;
  }
}

function assetToInstrument(asset: string): string {
  if (asset === "SILVER") return "silver925";
  if (asset === "COPPER") return "copper";
  return "gold18";
}

function sideToType(side: string): string {
  if (side === "SELL") return "فروش";
  if (side === "BUY") return "خرید";
  return side;
}

type TradeRow = {
  id: string;
  user_id: string;
  asset: string;
  side: string;
  status: string;
  weight_ug: string | number | null;
  fee_irr: string | number | null;
  net_irr: string | number | null;
  created_at: string;
  tracking_code: string | null;
};

function mapTrade(row: TradeRow): AdminActivity {
  return {
    id: String(row.id),
    tracking_code: String(row.tracking_code ?? row.id),
    type: sideToType(String(row.side)),
    instrument: assetToInstrument(String(row.asset)),
    gold_mg: safeMg(asBig(row.weight_ug)),
    amount_toman: safeToman(asBig(row.net_irr)),
    fee_toman: safeToman(asBig(row.fee_irr)),
    status: String(row.status),
    created_at: String(row.created_at),
    user_id: String(row.user_id),
    payment_ref: null,
    note: null,
    profiles: null,
  };
}

const TRADE_COLUMNS =
  "id, user_id, asset, side, status, weight_ug, fee_irr, net_irr, created_at, tracking_code";

async function attachProfiles(rows: AdminActivity[]): Promise<AdminActivity[]> {
  const sb = await adminDb();
  if (!sb || rows.length === 0) return rows;
  const ids = [...new Set(rows.map((row) => row.user_id).filter((id) => id && id !== PLATFORM_HOLDER))];
  if (ids.length === 0) return rows;
  const { data } = await sb
    .from("profiles")
    .select("id, first_name, last_name, phone, email")
    .in("id", ids);
  const byId = Object.fromEntries((data ?? []).map((profile) => [profile.id as string, profile]));
  return rows.map((row) => {
    const profile = byId[row.user_id];
    return {
      ...row,
      profiles: profile
        ? {
            first_name: profile.first_name ?? null,
            last_name: profile.last_name ?? null,
            phone: profile.phone ?? null,
            email: profile.email ?? null,
          }
        : null,
    };
  });
}

export async function listCoreTrades(opts?: {
  userId?: string;
  since?: string;
  limit?: number;
}): Promise<AdminActivity[]> {
  const sb = await adminDb();
  if (!sb) return [];
  let query = sb
    .from("core_trades")
    .select(TRADE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.userId) query = query.eq("user_id", opts.userId);
  if (opts?.since) query = query.gte("created_at", opts.since);
  const { data, error } = await query;
  if (error || !data) return [];
  return attachProfiles((data as TradeRow[]).map(mapTrade));
}

export async function getCoreTrade(id: string): Promise<AdminActivity | null> {
  const sb = await adminDb();
  if (!sb) return null;
  const { data, error } = await sb.from("core_trades").select(TRADE_COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const [row] = await attachProfiles([mapTrade(data as TradeRow)]);
  return row ?? null;
}

export async function countCoreTrades(): Promise<number | null> {
  const sb = await adminDb();
  if (!sb) return null;
  const { count, error } = await sb.from("core_trades").select("id", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

type JournalHeader = {
  id: string;
  created_at: string;
  reason: string | null;
  ref_type: string;
  ref_id: string;
};

type JournalLine = {
  journal_id: string;
  holder_id: string;
  account_code: string;
  asset: string;
  debit: string | number | null;
  credit: string | number | null;
};

function mapOpening(journal: JournalHeader, lines: JournalLine[]): AdminActivity | null {
  const userIrr = lines.find(
    (line) =>
      line.account_code === "USER_AVAILABLE" &&
      line.asset === "IRR" &&
      line.holder_id !== PLATFORM_HOLDER
  );
  if (!userIrr) return null;
  const debit = asBig(userIrr.debit);
  const credit = asBig(userIrr.credit);
  if (debit === 0n && credit === 0n) return null;
  const amount = credit > debit ? credit : debit;
  const type = credit > debit ? "واریز" : "برداشت";
  return {
    id: String(journal.id),
    tracking_code: String(journal.ref_id || journal.id),
    type,
    instrument: null,
    gold_mg: 0,
    amount_toman: safeToman(amount),
    fee_toman: 0,
    status: "تکمیل‌شده",
    created_at: String(journal.created_at),
    user_id: String(userIrr.holder_id),
    payment_ref: String(journal.ref_type),
    note: journal.reason ? String(journal.reason) : null,
    profiles: null,
  };
}

async function linesFor(journalIds: string[]): Promise<JournalLine[]> {
  const sb = await adminDb();
  if (!sb || journalIds.length === 0) return [];
  const { data, error } = await sb
    .from("core_journal_lines")
    .select("journal_id, holder_id, account_code, asset, debit, credit")
    .in("journal_id", journalIds);
  if (error || !data) return [];
  return data as JournalLine[];
}

export async function listOpeningJournals(opts?: {
  userId?: string;
  since?: string;
  limit?: number;
}): Promise<AdminActivity[]> {
  const sb = await adminDb();
  if (!sb) return [];
  let query = sb
    .from("core_journals")
    .select("id, created_at, reason, ref_type, ref_id")
    .eq("ref_type", "APPROVED_OPENING_BALANCE")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.since) query = query.gte("created_at", opts.since);
  const { data, error } = await query;
  if (error || !data?.length) return [];
  const headers = data as JournalHeader[];
  const lines = await linesFor(headers.map((journal) => journal.id));
  const grouped = new Map<string, JournalLine[]>();
  for (const line of lines) {
    const list = grouped.get(line.journal_id) ?? [];
    list.push(line);
    grouped.set(line.journal_id, list);
  }
  const rows = headers
    .map((journal) => mapOpening(journal, grouped.get(journal.id) ?? []))
    .filter((row): row is AdminActivity => row != null)
    .filter((row) => !opts?.userId || row.user_id === opts.userId);
  return attachProfiles(rows);
}

export async function getJournalActivity(id: string): Promise<AdminActivity | null> {
  const sb = await adminDb();
  if (!sb) return null;
  const { data, error } = await sb
    .from("core_journals")
    .select("id, created_at, reason, ref_type, ref_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const header = data as JournalHeader;
  if (header.ref_type !== "APPROVED_OPENING_BALANCE") return null;
  const lines = await linesFor([header.id]);
  const mapped = mapOpening(header, lines);
  if (!mapped) return null;
  const [row] = await attachProfiles([mapped]);
  return row ?? null;
}

export async function listAdminActivity(opts?: {
  userId?: string;
  type?: string;
  since?: string;
  limit?: number;
}): Promise<AdminActivity[]> {
  const limit = opts?.limit ?? 200;
  const [trades, journals] = await Promise.all([
    listCoreTrades({ userId: opts?.userId, since: opts?.since, limit }),
    listOpeningJournals({ userId: opts?.userId, since: opts?.since, limit }),
  ]);
  let rows = [...trades, ...journals].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  if (opts?.type) {
    if (opts.type === "خرید" || opts.type === "فروش") {
      rows = rows.filter((row) => row.type === opts.type);
    } else {
      rows = rows.filter((row) => row.type === opts.type);
    }
  }
  return rows.slice(0, limit);
}

export async function getAdminActivity(id: string): Promise<AdminActivity | null> {
  return (await getCoreTrade(id)) ?? (await getJournalActivity(id));
}

function searchToken(raw: string) {
  return raw.trim().replace(/[%(),]/g, "").slice(0, 80);
}

export async function searchLedgerActivity(raw: string): Promise<AdminActivity[]> {
  const term = searchToken(raw);
  const sb = await adminDb();
  if (!sb || term.length < 2) return [];
  const like = `%${term}%`;
  const [trades, journals] = await Promise.all([
    sb
      .from("core_trades")
      .select(TRADE_COLUMNS)
      .or(`tracking_code.ilike.${like},id.eq.${term}`)
      .limit(20),
    sb
      .from("core_journals")
      .select("id, created_at, reason, ref_type, ref_id")
      .eq("ref_type", "APPROVED_OPENING_BALANCE")
      .or(`id.eq.${term},ref_id.eq.${term},ref_id.ilike.${like}`)
      .limit(20),
  ]);
  const tradeRows = trades.error || !trades.data ? [] : (trades.data as TradeRow[]).map(mapTrade);
  let journalRows: AdminActivity[] = [];
  if (!journals.error && journals.data?.length) {
    const headers = journals.data as JournalHeader[];
    const lines = await linesFor(headers.map((journal) => journal.id));
    const grouped = new Map<string, JournalLine[]>();
    for (const line of lines) {
      const list = grouped.get(line.journal_id) ?? [];
      list.push(line);
      grouped.set(line.journal_id, list);
    }
    journalRows = headers
      .map((journal) => mapOpening(journal, grouped.get(journal.id) ?? []))
      .filter((row): row is AdminActivity => row != null);
  }
  return [...tradeRows, ...journalRows].slice(0, 20);
}
