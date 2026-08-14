import { isSupabaseConfigured } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { roleFromProfileRole } from "@/lib/admin/rbac";

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
      wallets,
      kyc,
      price,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["OPEN", "WAITING_USER"]),
      supabase.from("wallets").select("gold_mg, toman_available"),
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

    const goldMg =
      wallets.data?.reduce((sum, w) => sum + Number(w.gold_mg || 0), 0) ?? 0;
    const tomanAvailable =
      wallets.data?.reduce((sum, w) => sum + Number(w.toman_available || 0), 0) ??
      0;

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
  const supabase = await getDb();
  const { data } = await supabase
    .from("transactions")
    .select("*, profiles(first_name,last_name,phone)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listWallets(limit = 50) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getDb();
  const { data } = await supabase
    .from("wallets")
    .select("*, profiles(first_name,last_name,phone,kyc_status)")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return data ?? [];
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

export async function listDeliveries(limit = 50) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getDb();
  const { data } = await supabase
    .from("delivery_requests")
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
  return data.map((r) => ({
    ...r,
    inviter: byId[r.inviter_id as string],
    invitee: byId[r.invitee_id as string],
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
