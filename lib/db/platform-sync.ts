import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import type {
  DemoGoal,
  DemoNotification,
  DemoTransaction,
  SupportTicket,
} from "@/lib/app/demo-store";

export type PlatformBundle = {
  goldMg: number;
  silverMg: number;
  copperMg: number;
  rialAvailable: number;
  rialPending: number;
  avgBuyPriceRial: number;
  avgBuyPriceSilverRial: number;
  avgBuyPriceCopperRial: number;
  bankAccounts: { id: string; iban: string; bank: string; verified: boolean }[];
  transactions: DemoTransaction[];
  goals: DemoGoal[];
  notifications: DemoNotification[];
  tickets: SupportTicket[];
  alerts: {
    id: string;
    direction: "above" | "below";
    priceRial: number;
    channels: string[];
    status: "ACTIVE" | "TRIGGERED" | "DISABLED";
  }[];
};

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

async function authedClient() {
  if (!hasSupabaseEnv()) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

const EMPTY_LEDGER_BALANCES = {
  goldMg: 0,
  silverMg: 0,
  copperMg: 0,
  rialAvailable: 0,
  rialPending: 0,
  avgBuyPriceRial: 0,
  avgBuyPriceSilverRial: 0,
  avgBuyPriceCopperRial: 0,
};

/** Session-scoped ledger balances. A failed read stays at zero — never `wallets`. */
async function loadLedgerBalances() {
  try {
    const res = await fetch("/api/me/balances", { credentials: "include", cache: "no-store" });
    if (!res.ok) return EMPTY_LEDGER_BALANCES;
    const data = (await res.json()) as {
      ok?: boolean;
      source?: string;
      ui?: {
        goldMg?: number;
        silverMg?: number;
        copperMg?: number;
        rialAvailable?: number;
        rialPending?: number;
      };
      avgBuyTomanPerGram?: { gold18?: number; silver925?: number; copper?: number };
    };
    if (!data.ok || data.source !== "ledger" || !data.ui) return EMPTY_LEDGER_BALANCES;
    return {
      goldMg: Number(data.ui.goldMg ?? 0),
      silverMg: Number(data.ui.silverMg ?? 0),
      copperMg: Number(data.ui.copperMg ?? 0),
      rialAvailable: Number(data.ui.rialAvailable ?? 0),
      rialPending: Number(data.ui.rialPending ?? 0),
      avgBuyPriceRial: Number(data.avgBuyTomanPerGram?.gold18 ?? 0),
      avgBuyPriceSilverRial: Number(data.avgBuyTomanPerGram?.silver925 ?? 0),
      avgBuyPriceCopperRial: Number(data.avgBuyTomanPerGram?.copper ?? 0),
    };
  } catch {
    return EMPTY_LEDGER_BALANCES;
  }
}

export async function loadPlatformBundle(): Promise<PlatformBundle | null> {
  const auth = await authedClient();
  if (!auth) return null;
  const { supabase, user } = auth;

  const [
    ledger,
    banks,
    goals,
    notifications,
    tickets,
    alerts,
  ] = await Promise.all([
    loadLedgerBalances(),
    supabase.from("bank_accounts").select("*").eq("user_id", user.id),
    supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", {
      ascending: false,
    }),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("support_tickets")
      .select("*, support_messages(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("price_alerts").select("*").eq("user_id", user.id),
  ]);

  return {
    goldMg: ledger.goldMg,
    silverMg: ledger.silverMg,
    copperMg: ledger.copperMg,
    rialAvailable: ledger.rialAvailable,
    rialPending: ledger.rialPending,
    avgBuyPriceRial: ledger.avgBuyPriceRial,
    avgBuyPriceSilverRial: ledger.avgBuyPriceSilverRial,
    avgBuyPriceCopperRial: ledger.avgBuyPriceCopperRial,
    bankAccounts: (banks.data ?? []).map((b) => ({
      id: b.id,
      iban: b.iban,
      bank: b.bank_name,
      verified: b.verified,
    })),
    transactions: [],
    goals: (goals.data ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      targetRial: Number(g.target_toman),
      currentRial: Number(g.current_toman),
      targetDate: g.target_date ?? "",
      monthlyRial: Number(g.monthly_toman),
    })),
    notifications: (notifications.data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      createdAt: new Date(n.created_at).toLocaleString("fa-IR"),
      read: n.read,
      href: n.href ?? undefined,
    })),
    tickets: (tickets.data ?? []).map((t) => ({
      id: t.id,
      category: t.category,
      subject: t.subject,
      status: t.status,
      createdAt: new Date(t.created_at).toLocaleString("fa-IR"),
      messages: (t.support_messages ?? [])
        .slice()
        .sort(
          (a: { created_at: string }, b: { created_at: string }) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        .map((m: { sender: string; body: string; created_at: string }) => ({
          from: m.sender === "user" ? ("user" as const) : ("support" as const),
          text: m.body,
          at: new Date(m.created_at).toLocaleString("fa-IR"),
        })),
    })),

    alerts: (alerts.data ?? []).map((a) => ({
      id: a.id,
      direction: a.direction as "above" | "below",
      priceRial: Number(a.price_toman),
      channels: a.channels ?? ["app"],
      status: a.status as "ACTIVE" | "TRIGGERED" | "DISABLED",
      autoBuyEnabled: Boolean(a.auto_buy_enabled),
      autoBuyToman: Number(a.auto_buy_toman ?? 0),
    })),
  };
}

export async function persistGoal(goal: DemoGoal) {
  const auth = await authedClient();
  if (!auth) return;
  const row: Record<string, unknown> = {
    user_id: auth.user.id,
    name: goal.name,
    target_toman: goal.targetRial,
    current_toman: goal.currentRial,
    target_date: goal.targetDate || null,
    monthly_toman: goal.monthlyRial,
  };
  if (isUuid(goal.id)) row.id = goal.id;
  const { error } = await auth.supabase.from("goals").upsert(row, {
    onConflict: "id",
  });
  if (error) console.error("persistGoal", error.message);
}

export async function persistTicket(
  ticket: SupportTicket,
  firstMessage?: string
) {
  const auth = await authedClient();
  if (!auth) return;

  const ticketRow: Record<string, unknown> = {
    user_id: auth.user.id,
    category: ticket.category,
    subject: ticket.subject,
    status: ticket.status,
    updated_at: new Date().toISOString(),
  };
  if (isUuid(ticket.id)) ticketRow.id = ticket.id;

  const { data, error } = await auth.supabase
    .from("support_tickets")
    .upsert(ticketRow, { onConflict: "id" })
    .select("id")
    .single();
  if (error) {
    console.error("persistTicket", error.message);
    return;
  }

  const ticketId = data?.id ?? ticket.id;
  if (firstMessage) {
    const { error: msgError } = await auth.supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender: "user",
        body: firstMessage,
      });
    if (msgError) console.error("persistTicketMessage", msgError.message);
  }
}

export async function persistTicketReply(
  ticketId: string,
  text: string,
  sender: "user" | "support" | "admin" = "user"
) {
  const auth = await authedClient();
  if (!auth || !isUuid(ticketId)) return;
  const { error } = await auth.supabase.from("support_messages").insert({
    ticket_id: ticketId,
    sender,
    body: text,
  });
  if (error) console.error("persistTicketReply", error.message);
  await auth.supabase
    .from("support_tickets")
    .update({
      status: sender === "user" ? "WAITING_USER" : "OPEN",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);
}


export async function persistBankAccount(input: {
  id: string;
  iban: string;
  bank: string;
  verified: boolean;
}) {
  const auth = await authedClient();
  if (!auth) return;
  const row: Record<string, unknown> = {
    user_id: auth.user.id,
    bank_name: input.bank,
    iban: input.iban,
    verified: input.verified,
  };
  if (isUuid(input.id)) row.id = input.id;
  const { error } = await auth.supabase.from("bank_accounts").upsert(row, {
    onConflict: "id",
  });
  if (error) console.error("persistBankAccount", error.message);
}

export async function persistAlert(input: {
  id: string;
  direction: "above" | "below";
  priceRial: number;
  channels: string[];
  status: string;
  autoBuyEnabled?: boolean;
  autoBuyToman?: number;
}) {
  const auth = await authedClient();
  if (!auth) return;
  const row: Record<string, unknown> = {
    user_id: auth.user.id,
    direction: input.direction,
    price_toman: input.priceRial,
    channels: input.channels,
    status: input.status,
    auto_buy_enabled: Boolean(input.autoBuyEnabled),
    auto_buy_toman: input.autoBuyToman ?? 0,
  };
  if (isUuid(input.id)) row.id = input.id;
  const { error } = await auth.supabase.from("price_alerts").upsert(row, {
    onConflict: "id",
  });
  if (error) console.error("persistAlert", error.message);
}

export async function persistNotification(n: DemoNotification) {
  const auth = await authedClient();
  if (!auth) return;
  const row: Record<string, unknown> = {
    user_id: auth.user.id,
    type: n.type,
    title: n.title,
    message: n.message,
    href: n.href ?? null,
    read: n.read,
  };
  if (isUuid(n.id)) row.id = n.id;
  const { error } = await auth.supabase.from("notifications").upsert(row, {
    onConflict: "id",
  });
  if (error) console.error("persistNotification", error.message);
}

export async function markNotificationsRead(ids?: string[]) {
  const auth = await authedClient();
  if (!auth) return;
  let q = auth.supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", auth.user.id);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) console.error("markNotificationsRead", error.message);
}
