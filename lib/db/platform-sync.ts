import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/client";
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

export async function loadPlatformBundle(): Promise<PlatformBundle | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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
    supabase.from("goals").select("*").eq("user_id", user.id),
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
    })),
  };
}

export async function persistWallet(input: {
  goldMg: number;
  rialAvailable: number;
  rialPending: number;
  avgBuyPriceRial: number;
}) {
  if (!hasSupabaseEnv()) return;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("wallets").upsert(
    {
      user_id: user.id,
      gold_mg: input.goldMg,
      toman_available: input.rialAvailable,
      toman_pending: input.rialPending,
      avg_buy_price_toman: input.avgBuyPriceRial,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function persistTransaction(tx: DemoTransaction) {
  if (!hasSupabaseEnv()) return;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("transactions").upsert({
    id: tx.id.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
      ? tx.id
      : undefined,
    user_id: user.id,
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
  });
}
