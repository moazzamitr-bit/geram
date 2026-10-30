import { writeAudit } from "@/lib/admin/audit";
import { isUuid, maskIp, parseUserAgent, sessionIdFromJwt } from "@/lib/auth/sessions";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const err = (status: number, error: string, message: string) =>
  Response.json({ ok: false, error, message }, { status });

async function current() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return { userId: user.id, sessionId: sessionIdFromJwt(session?.access_token) };
}

export async function GET() {
  const me = await current();
  if (!me) return err(401, "unauthorized", "ابتدا وارد شوید.");
  const { data, error } = await createServiceClient().rpc("user_sessions_list", { p_user_id: me.userId });
  if (error) { console.error("sessions list", error.message); return err(500, "server", "خواندن نشست‌ها ممکن نشد."); }
  const rows = (data ?? []) as Array<{ id: string; created_at: string; updated_at: string | null; refreshed_at: string | null; user_agent: string | null; ip: string | null }>;
  const sessions = rows.map((r) => ({
    id: r.id,
    device: parseUserAgent(r.user_agent),
    ip: maskIp(r.ip),
    createdAt: r.created_at,
    lastActiveAt: r.refreshed_at ? new Date(r.refreshed_at + "Z").toISOString() : r.updated_at ?? r.created_at,
    current: r.id === me.sessionId,
  }));
  sessions.sort((a, b) => Number(b.current) - Number(a.current));
  return Response.json({ ok: true, sessions });
}

export async function DELETE(request: Request) {
  const me = await current();
  if (!me) return err(401, "unauthorized", "ابتدا وارد شوید.");
  if (!rateLimit(`sessions:${me.userId}`, 20, 60 * 60_000).ok) return err(429, "too_many", "تعداد درخواست زیاد است.");
  const id = new URL(request.url).searchParams.get("id");
  const all = new URL(request.url).searchParams.get("scope") === "others";
  const admin = createServiceClient();
  if (all) {
    const { data } = await admin.rpc("user_sessions_list", { p_user_id: me.userId });
    let n = 0;
    for (const r of (data ?? []) as Array<{ id: string }>) {
      if (r.id === me.sessionId) continue;
      const { data: ok } = await admin.rpc("user_session_revoke", { p_user_id: me.userId, p_session_id: r.id });
      if (ok) n++;
    }
    await writeAudit({ actorId: me.userId, action: "session.revoke_others", entity: "auth_session", entityId: me.sessionId, meta: { count: n } });
    return Response.json({ ok: true, count: n, message: "از همه دستگاه‌های دیگر خارج شدید." });
  }
  if (!isUuid(id)) return err(400, "bad_request", "شناسه نشست نامعتبر است.");
  if (id === me.sessionId) return err(400, "current", "برای خروج از این دستگاه از دکمه خروج استفاده کنید.");
  const { data: ok, error } = await admin.rpc("user_session_revoke", { p_user_id: me.userId, p_session_id: id });
  if (error) return err(500, "server", "خروج از نشست ممکن نشد.");
  if (!ok) return err(404, "not_found", "این نشست پیدا نشد یا قبلاً بسته شده.");
  await writeAudit({ actorId: me.userId, action: "session.revoke", entity: "auth_session", entityId: id });
  return Response.json({ ok: true, message: "دستگاه از حساب خارج شد." });
}
