import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/db/types";

export async function adminDb() {
  if (!isSupabaseConfigured()) return null;
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

export async function getProfile(id: string) {
  const sb = await adminDb();
  if (!sb) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function getWallet(userId: string) {
  const sb = await adminDb();
  if (!sb) return null;
  const { data } = await sb.from("wallets").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

export async function getUserTransactions(userId: string, limit = 50) {
  const sb = await adminDb();
  if (!sb) return [];
  const { data } = await sb
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getUserBanks(userId: string) {
  const sb = await adminDb();
  if (!sb) return [];
  const { data } = await sb.from("bank_accounts").select("*").eq("user_id", userId);
  return data ?? [];
}

export async function getUserTickets(userId: string) {
  const sb = await adminDb();
  if (!sb) return [];
  const { data } = await sb
    .from("support_tickets")
    .select("*, support_messages(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listBanks(limit = 200) {
  const sb = await adminDb();
  if (!sb) return [];
  const { data } = await sb
    .from("bank_accounts")
    .select("*, profiles(first_name,last_name,phone,email)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getTicket(id: string) {
  const sb = await adminDb();
  if (!sb) return null;
  const { data } = await sb
    .from("support_tickets")
    .select("*, profiles(first_name,last_name,phone,email), support_messages(*)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function getTransaction(id: string) {
  const sb = await adminDb();
  if (!sb) return null;
  const { data } = await sb
    .from("transactions")
    .select("*, profiles(first_name,last_name,phone,email)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function listTransactionsFiltered(opts: {
  type?: string;
  limit?: number;
}) {
  const sb = await adminDb();
  if (!sb) return [];
  let q = sb
    .from("transactions")
    .select("*, profiles(first_name,last_name,phone,email)")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.type) q = q.eq("type", opts.type);
  const { data } = await q;
  return data ?? [];
}

export async function listNotifications(limit = 100) {
  const sb = await adminDb();
  if (!sb) return [];
  const { data } = await sb
    .from("notifications")
    .select("*, profiles(first_name,last_name,phone)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listDca(limit = 100) {
  const sb = await adminDb();
  if (!sb) return [];
  const { data } = await sb
    .from("scheduled_purchases")
    .select("*, profiles(first_name,last_name,phone)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listAlerts(limit = 100) {
  const sb = await adminDb();
  if (!sb) return [];
  const { data } = await sb
    .from("price_alerts")
    .select("*, profiles(first_name,last_name,phone)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function searchOps(q: string) {
  const sb = await adminDb();
  if (!sb || !q.trim()) return { users: [], txs: [], tickets: [], banks: [], journals: [], journalsReady: false };
  const term = q.trim();
  const like = `%${term}%`;
  const [users, txs, tickets, banks, journals] = await Promise.all([
    sb.from("profiles").select("id, first_name, last_name, phone, email, role, kyc_status").or(`email.ilike.${like},phone.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},id.eq.${term}`).limit(20),
    sb.from("transactions").select("id, tracking_code, type, status, user_id").or(`tracking_code.ilike.${like},id.eq.${term},payment_ref.ilike.${like}`).limit(20),
    sb.from("support_tickets").select("id, subject, status, user_id").or(`subject.ilike.${like},id.eq.${term}`).limit(20),
    sb.from("bank_accounts").select("id, iban, bank_name, user_id").ilike("iban", `%${term.slice(-4)}%`).limit(20),
    sb.from("core_journals").select("id, reason, ref_type, ref_id, created_at").or(`id.eq.${term},ref_id.eq.${term}`).limit(20),
  ]);
  return {
    users: users.data ?? [],
    txs: txs.data ?? [],
    tickets: tickets.data ?? [],
    banks: banks.data ?? [],
    journals: journals.error ? [] : journals.data ?? [],
    journalsReady: !journals.error,
  };
}

export async function recomputeFromJournal(userId: string) {
  const sb = await adminDb();
  if (!sb) return { ready: false as const, error: "no db" };
  const accounts = await sb.from("core_ledger_accounts").select("*").eq("holder_id", userId);
  if (accounts.error) {
    return { ready: false as const, error: accounts.error.message };
  }
  const lines = await sb.from("core_journal_lines").select("*").eq("holder_id", userId);
  if (lines.error) {
    return { ready: false as const, error: lines.error.message };
  }
  const derived: Record<string, number> = {};
  for (const line of lines.data ?? []) {
    const key = `${line.account_code}:${line.asset}`;
    derived[key] = (derived[key] ?? 0) + Number(line.debit || 0) - Number(line.credit || 0);
  }
  const cached = (accounts.data ?? []).map((a) => ({
    account: a.account_code,
    asset: a.asset,
    cached: Number(a.balance || 0),
    derived: derived[`${a.account_code}:${a.asset}`] ?? 0,
  }));
  const mismatch = cached.some((r) => r.cached !== r.derived);
  return { ready: true as const, cached, mismatch };
}
