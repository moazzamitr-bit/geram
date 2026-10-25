import { isSupabaseConfigured } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { roleFromProfileRole } from "@/lib/admin/rbac";
import { countCoreTrades, listAdminActivity } from "@/lib/admin/ledger-activity";
import { sumCustomerLedger } from "@/lib/ledger/display";
import { readLedgerAccountRows } from "@/lib/ledger/read";

async function getDb() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createServiceClient();
  }
  return createClient();
}

export async function getAdminOverview() {
  if (!isSupabaseConfigured()) {
    return {
      connected: false as const,
      users: 0,
      transactions: 0,
      openTickets: 0,
      goldMg: 0,
      tomanAvailable: 0,
      pendingKyc: 0,
      latestPrice: null as number | null,
    };
  }

  try {
    const supabase = await getDb();
    const [
      users,
      txs,
      tickets,
      kyc,
      price,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      Promise.resolve({ count: await countCoreTrades() }),
      supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["OPEN", "WAITING_USER"]),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("kyc_status", "PENDING"),
      supabase
        .from("market_prices")
        .select("price_toman")
        .eq("instrument", "gold18")
        .order("observed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const ledger = await readLedgerAccountRows();
    const books = ledger.ok ? sumCustomerLedger(ledger.rows) : null;
    const goldMg = books?.goldMg ?? 0;
    const tomanAvailable = books?.availableToman ?? 0;

    return {
      connected: true as const,
      users: users.count ?? 0,
      transactions: txs.count ?? 0,
      openTickets: tickets.count ?? 0,
      goldMg,
      tomanAvailable,
      pendingKyc: kyc.count ?? 0,
      latestPrice: price.data?.price_toman ?? null,
    };
  } catch {
    return {
      connected: false as const,
      users: 0,
      transactions: 0,
      openTickets: 0,
      goldMg: 0,
      tomanAvailable: 0,
      pendingKyc: 0,
      latestPrice: null as number | null,
    };
  }
}

export async function listProfiles(limit = 50) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getDb();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listTransactions(limit = 50) {
  if (!isSupabaseConfigured()) return [];
  return listAdminActivity({ limit });
}

export async function listTickets(limit = 50) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getDb();
  const { data } = await supabase
    .from("support_tickets")
    .select("*, profiles(first_name,last_name,phone)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listGoals(limit = 50) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getDb();
  const { data } = await supabase
    .from("goals")
    .select("*, profiles(first_name,last_name,phone)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listMarketPrices(limit = 30) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getDb();
  const { data } = await supabase
    .from("market_prices")
    .select("*")
    .eq("instrument", "gold18")
    .order("observed_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listReferralEvents(limit = 100) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getDb();
  const { data } = await supabase
    .from("referral_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data?.length) return [];
  const ids = [
    ...new Set(data.flatMap((r) => [r.inviter_id, r.invitee_id])),
  ];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, phone, referral_code, kyc_status")
    .in("id", ids);
  const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // Revenue-share model: the inviter earns a share of each invitee's settled
  // trade fees. core_trades has no RLS policies, so this needs the service role.
  const feesByInvitee: Record<string, number> = {};
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data: trades } = await createServiceClient()
      .from("core_trades")
      .select("user_id, fee_irr")
      .eq("status", "SETTLED")
      .in(
        "user_id",
        data.map((r) => r.invitee_id as string)
      );
    for (const t of trades ?? []) {
      const id = t.user_id as string;
      feesByInvitee[id] = (feesByInvitee[id] ?? 0) + Math.floor(Number(t.fee_irr) / 10);
    }
  }

  return data.map((r) => ({
    ...r,
    inviter: byId[r.inviter_id as string],
    invitee: byId[r.invitee_id as string],
    inviteeFeesToman: feesByInvitee[r.invitee_id as string] ?? 0,
  }));
}

export async function listPriceAlertOrders(limit = 50) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getDb();
  const { data } = await supabase
    .from("price_alert_orders")
    .select("*, profiles(first_name,last_name,phone)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function requireAdmin(): Promise<
  | { ok: true; user: { id: string }; profile: { role: string; first_name: string | null; last_name: string | null; email: string | null } }
  | { ok: false; reason: "not_configured" | "unauthenticated" | "forbidden" }
> {
  if (!isSupabaseConfigured()) return { ok: false as const, reason: "not_configured" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, reason: "unauthenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !roleFromProfileRole(profile.role)) {
    return { ok: false as const, reason: "forbidden" };
  }
  return { ok: true as const, user, profile };
}
