import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import type {
  DemoDelivery,
  DemoGoal,
  DemoNotification,
  DemoTransaction,
  SupportTicket,
} from "@/lib/app/demo-store";

export type PlatformBundle = {
  goldMg: number;
  rialAvailable: number;
  rialPending: number;
  avgBuyPriceRial: number;
  bankAccounts: { id: string; iban: string; bank: string; verified: boolean }[];
  transactions: DemoTransaction[];
  goals: DemoGoal[];
  deliveries: DemoDelivery[];
  notifications: DemoNotification[];
  tickets: SupportTicket[];
  scheduledPurchases: {
    id: string;
    amountRial: number;
    cadence: string;
    status: string;
    nextRun: string;
  }[];
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

export async function loadPlatformBundle(): Promise<PlatformBundle | null> {
  const auth = await authedClient();
  if (!auth) return null;
  const { supabase, user } = auth;

  const [
    wallet,
    banks,
    txs,
    goals,
    deliveries,
    notifications,
    tickets,
    scheduled,
    alerts,
  ] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("bank_accounts").select("*").eq("user_id", user.id),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", {
      ascending: false,
    }),
    supabase
      .from("delivery_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
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
    supabase.from("scheduled_purchases").select("*").eq("user_id", user.id),
    supabase.from("price_alerts").select("*").eq("user_id", user.id),
  ]);

  return {
    goldMg: Number(wallet.data?.gold_mg ?? 0),
    rialAvailable: Number(wallet.data?.toman_available ?? 0),
    rialPending: Number(wallet.data?.toman_pending ?? 0),
    avgBuyPriceRial: Number(wallet.data?.avg_buy_price_toman ?? 0),
    bankAccounts: (banks.data ?? []).map((b) => ({
      id: b.id,
      iban: b.iban,
      bank: b.bank_name,
      verified: b.verified,
    })),
    transactions: (txs.data ?? []).map((tx) => ({
      id: tx.id,
      trackingCode: tx.tracking_code,
      type: tx.type,
      goldMg: Number(tx.gold_mg),
      amountRial: Number(tx.amount_toman),
      feeRial: Number(tx.fee_toman),
      pricePerGram: Number(tx.price_per_gram_toman),
      status: tx.status,
      createdAt: new Date(tx.created_at).toLocaleString("fa-IR"),
      timeline: Array.isArray(tx.timeline) ? tx.timeline : [],
      paymentRef: tx.payment_ref ?? undefined,
      note: tx.note ?? undefined,
    })),
    goals: (goals.data ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      targetRial: Number(g.target_toman),
      currentRial: Number(g.current_toman),
      targetDate: g.target_date ?? "",
      monthlyRial: Number(g.monthly_toman),
    })),
    deliveries: (deliveries.data ?? []).map((d) => ({
      id: d.id,
      productId: d.product_id,
      productName: d.product_name,
      weightGrams: Number(d.weight_grams),
      status: d.status,
      method: d.method,
      createdAt: new Date(d.created_at).toLocaleString("fa-IR"),
      feeRial: Number(d.fee_toman),
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
    scheduledPurchases: (scheduled.data ?? []).map((s) => ({
      id: s.id,
      amountRial: Number(s.amount_toman),
      cadence: s.cadence,
      status: s.status,
      nextRun: s.next_run ?? "",
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

export async function persistWallet(input: {
  goldMg: number;
  rialAvailable: number;
  rialPending: number;
  avgBuyPriceRial: number;
}) {
  const auth = await authedClient();
  if (!auth) return;
  const { error } = await auth.supabase.from("wallets").upsert(
    {
      user_id: auth.user.id,
      gold_mg: input.goldMg,
      toman_available: input.rialAvailable,
      toman_pending: input.rialPending,
      avg_buy_price_toman: input.avgBuyPriceRial,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) console.error("persistWallet", error.message);
}

export async function persistTransaction(tx: DemoTransaction) {
  const auth = await authedClient();
  if (!auth) return;
  const row: Record<string, unknown> = {
    user_id: auth.user.id,
    tracking_code: tx.trackingCode,
    type: tx.type,
    gold_mg: tx.goldMg,
    amount_toman: tx.amountRial,
    fee_toman: tx.feeRial,
    price_per_gram_toman: tx.pricePerGram,
    status: tx.status,
    payment_ref: tx.paymentRef ?? null,
    note: tx.note ?? null,
    timeline: tx.timeline,
  };
  if (isUuid(tx.id)) row.id = tx.id;

  const { error } = await auth.supabase.from("transactions").upsert(row, {
    onConflict: isUuid(tx.id) ? "id" : "tracking_code",
  });
  if (error) console.error("persistTransaction", error.message);
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

export async function persistDelivery(delivery: DemoDelivery) {
  const auth = await authedClient();
  if (!auth) return;
  const row: Record<string, unknown> = {
    user_id: auth.user.id,
    product_id: delivery.productId,
    product_name: delivery.productName,
    weight_grams: delivery.weightGrams,
    method: delivery.method,
    fee_toman: delivery.feeRial,
    status: delivery.status,
  };
  if (isUuid(delivery.id)) row.id = delivery.id;
  const { error } = await auth.supabase.from("delivery_requests").upsert(row, {
    onConflict: "id",
  });
  if (error) console.error("persistDelivery", error.message);
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

export async function persistScheduledPurchase(input: {
  id: string;
  amountRial: number;
  cadence: string;
  status: string;
  nextRun: string;
}) {
  const auth = await authedClient();
  if (!auth) return;
  const nextRunAt = new Date();
  nextRunAt.setDate(nextRunAt.getDate() + 1);
  const row: Record<string, unknown> = {
    user_id: auth.user.id,
    amount_toman: input.amountRial,
    cadence: input.cadence,
    status: input.status,
    next_run: input.nextRun,
    next_run_at: nextRunAt.toISOString(),
  };
  if (isUuid(input.id)) row.id = input.id;
  const { error } = await auth.supabase.from("scheduled_purchases").upsert(row, {
    onConflict: "id",
  });
  if (error) console.error("persistScheduledPurchase", error.message);
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
