import "server-only";
import { isPlusActive } from "@/lib/commerce/fees";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { DEFAULT_COMMERCE_SETTINGS } from "@/lib/commerce/types";
import { CoreError } from "@/lib/core/types";
import { createServiceClient } from "@/lib/supabase/admin";

/** Server side of the user's alerts, tickets, notifications and bank accounts. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function db() {
  return createServiceClient();
}

function fail(error: { message: string } | null, what: string) {
  if (error) {
    console.error(`[user-data] ${what}`, error.message);
    throw new CoreError("storage_error", "ذخیره‌سازی ناموفق بود. دوباره تلاش کنید.", 500);
  }
}

function text(input: unknown, max: number, field: string) {
  const s = typeof input === "string" ? input.trim() : "";
  if (!s) throw new CoreError("invalid_input", `${field} را وارد کنید.`, 400);
  if (s.length > max) throw new CoreError("invalid_input", `${field} حداکثر ${max} کاراکتر است.`, 400);
  return s;
}

export async function listNotifications(userId: string) {
  const { data, error } = await db()
    .from("notifications")
    .select("id, type, title, message, href, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  fail(error, "notifications");
  return (data ?? []).map((n) => ({
    id: n.id as string,
    type: n.type as string,
    title: n.title as string,
    message: n.message as string,
    href: (n.href as string | null) ?? undefined,
    read: Boolean(n.read),
    createdAt: n.created_at as string,
  }));
}

export async function markNotificationsRead(userId: string, ids?: unknown) {
  let q = db().from("notifications").update({ read: true }).eq("user_id", userId);
  if (Array.isArray(ids)) {
    const clean = ids.filter((id): id is string => typeof id === "string" && UUID.test(id));
    if (clean.length === 0) return;
    q = q.in("id", clean);
  }
  const { error } = await q;
  fail(error, "notifications read");
}

export async function listAlerts(userId: string) {
  const { data, error } = await db()
    .from("price_alerts")
    .select("id, direction, price_toman, channels, status, auto_buy_enabled, auto_buy_toman, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  fail(error, "alerts");
  return (data ?? []).map((a) => ({
    id: a.id as string,
    direction: a.direction as "above" | "below",
    priceRial: Number(a.price_toman),
    channels: (a.channels as string[] | null) ?? ["app"],
    status: a.status as "ACTIVE" | "TRIGGERED" | "DISABLED",
    autoBuyEnabled: Boolean(a.auto_buy_enabled),
    autoBuyToman: Number(a.auto_buy_toman ?? 0),
  }));
}

export async function createAlert(userId: string, body: Record<string, unknown>) {
  const direction = body.direction === "below" ? "below" : body.direction === "above" ? "above" : null;
  if (!direction) throw new CoreError("invalid_input", "جهت هشدار نامعتبر است.", 400);
  const price = Math.round(Number(body.priceToman ?? body.priceRial));
  if (!Number.isFinite(price) || price <= 0) {
    throw new CoreError("invalid_input", "قیمت هدف را وارد کنید.", 400);
  }
  const channels = Array.isArray(body.channels)
    ? body.channels.filter((c): c is string => c === "app" || c === "sms" || c === "push")
    : ["app"];
  if (channels.length === 0) channels.push("app");
  const sb = db();
  if (channels.includes("sms")) {
    const settings = await loadCommerceSettings().catch(() => DEFAULT_COMMERCE_SETTINGS);
    if (settings.plus.smsAlertsPlusOnly) {
      const { data: p } = await sb.from("profiles").select("plan_tier, plan_expires_at").eq("id", userId).maybeSingle();
      if (!isPlusActive((p?.plan_tier as "free" | "plus") ?? "free", p?.plan_expires_at)) {
        throw new CoreError("plus_required", "اعلان پیامکی فقط برای اعضای گرم پلاس است.", 403);
      }
    }
  }
  const { count } = await sb
    .from("price_alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "ACTIVE");
  if ((count ?? 0) >= 20) throw new CoreError("too_many", "حداکثر ۲۰ هشدار فعال مجاز است.", 400);
  const autoBuyToman = Math.max(0, Math.round(Number(body.autoBuyToman ?? 0)) || 0);
  const { data, error } = await sb
    .from("price_alerts")
    .insert({
      user_id: userId,
      direction,
      price_toman: price,
      channels,
      status: "ACTIVE",
      auto_buy_enabled: Boolean(body.autoBuyEnabled) && autoBuyToman > 0,
      auto_buy_toman: autoBuyToman,
    })
    .select("id")
    .single();
  fail(error, "alert insert");
  return data!.id as string;
}

export async function disableAlert(userId: string, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new CoreError("invalid_input", "هشدار پیدا نشد.", 404);
  const { data, error } = await db()
    .from("price_alerts")
    .update({ status: "DISABLED" })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  fail(error, "alert disable");
  if (!data?.length) throw new CoreError("not_found", "هشدار پیدا نشد.", 404);
}

type MsgRow = { sender: string; body: string; created_at: string };

export async function listTickets(userId: string) {
  const { data, error } = await db()
    .from("support_tickets")
    .select("id, category, subject, status, created_at, support_messages(sender, body, created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  fail(error, "tickets");
  return (data ?? []).map((t) => ({
    id: t.id as string,
    category: t.category as string,
    subject: t.subject as string,
    status: t.status as string,
    createdAt: t.created_at as string,
    messages: ((t.support_messages as MsgRow[] | null) ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => ({
        from: m.sender === "user" ? ("user" as const) : ("support" as const),
        text: m.body,
        at: m.created_at,
      })),
  }));
}

export async function createTicket(userId: string, body: Record<string, unknown>) {
  const category = text(body.category, 40, "دسته");
  const subject = text(body.subject, 120, "موضوع");
  const message = text(body.message, 2000, "متن پیام");
  const sb = db();
  const { count } = await sb
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= 10) throw new CoreError("too_many", "امروز بیش از حد مجاز تیکت ثبت کرده‌اید.", 429);
  const { data, error } = await sb
    .from("support_tickets")
    .insert({ user_id: userId, category, subject, status: "OPEN" })
    .select("id")
    .single();
  fail(error, "ticket insert");
  const id = data!.id as string;
  const { error: msgErr } = await sb.from("support_messages").insert({ ticket_id: id, sender: "user", body: message });
  if (msgErr) {
    await sb.from("support_tickets").delete().eq("id", id);
    fail(msgErr, "ticket message");
  }
  return id;
}

export async function replyTicket(userId: string, ticketId: string, body: Record<string, unknown>) {
  if (!UUID.test(ticketId)) throw new CoreError("not_found", "تیکت پیدا نشد.", 404);
  const message = text(body.message, 2000, "متن پیام");
  const sb = db();
  const { data: t } = await sb
    .from("support_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!t) throw new CoreError("not_found", "تیکت پیدا نشد.", 404);
  if (t.status === "CLOSED") throw new CoreError("ticket_closed", "این تیکت بسته شده است. تیکت جدید ثبت کنید.", 400);
  const { error } = await sb.from("support_messages").insert({ ticket_id: ticketId, sender: "user", body: message });
  fail(error, "ticket reply");
  // The user answered: the ticket now waits on support.
  await sb.from("support_tickets").update({ status: "OPEN", updated_at: new Date().toISOString() }).eq("id", ticketId);
}

export async function listBankAccounts(userId: string) {
  const { data, error } = await db()
    .from("bank_accounts")
    .select("id, iban, bank_name, verified")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  fail(error, "bank accounts");
  return (data ?? []).map((b) => ({
    id: b.id as string,
    iban: b.iban as string,
    bank: b.bank_name as string,
    verified: Boolean(b.verified),
  }));
}

export async function addBankAccount(userId: string, body: Record<string, unknown>) {
  const iban = String(body.iban ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^IR\d{24}$/.test(iban)) throw new CoreError("invalid_iban", "شبا باید IR و ۲۴ رقم باشد.", 400);
  const bank = text(body.bank, 60, "نام بانک");
  const sb = db();
  const { data: dup } = await sb.from("bank_accounts").select("id").eq("user_id", userId).eq("iban", iban).maybeSingle();
  if (dup) throw new CoreError("duplicate", "این شبا قبلاً ثبت شده است.", 409);
  // Ownership is never self-asserted: verified stays false until a KYC check sets it.
  const { error } = await sb.from("bank_accounts").insert({ user_id: userId, iban, bank_name: bank, verified: false });
  fail(error, "bank insert");
}
