import {
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listAudit } from "@/lib/admin/audit";
import { maskEmail } from "@/lib/admin/mask";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listAudit(400);
  const filtered = rows.filter((r) => {
    if (sp.action && !String(r.action).includes(sp.action)) return false;
    if (sp.actor && !String(r.actor_id ?? "").includes(sp.actor)) return false;
    return true;
  });

  return (
    <div>
      <AdminPageHeader title="لاگ حسابرسی" description="تغییرناپذیر. حذف/ویرایش وجود ندارد. مقادیر حساس در meta باید redacted باشند." />
      <AdminNotice title="sink">public.audit_logs — append-only از سمت ادمین.</AdminNotice>
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/audit">
        <input name="action" defaultValue={sp.action ?? ""} placeholder="action" className="h-10 rounded-xl border border-white/10 bg-[#0B1220] px-3 text-[13px]" />
        <input name="actor" defaultValue={sp.actor ?? ""} placeholder="actor id" className="h-10 rounded-xl border border-white/10 bg-[#0B1220] px-3 text-[13px]" />
        <button className="text-gold text-[13px]" type="submit">فیلتر</button>
      </form>
      <AdminTable headers={["زمان", "کنش", "بازیگر", "هدف", "نتیجه"]} empty={filtered.length === 0}>
        {filtered.map((r) => {
          const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          const meta = (r.meta ?? {}) as { result?: string; reason?: string };
          return (
            <tr key={r.id} className="border-b border-white/5">
              <td className="px-4 py-3 text-white/45">{new Date(r.created_at).toLocaleString("fa-IR")}</td>
              <td className="px-4 py-3 font-mono text-[12px]">{r.action}</td>
              <td className="px-4 py-3">{maskEmail(profile?.email) || String(r.actor_id ?? "—").slice(0, 8)}</td>
              <td className="px-4 py-3 font-mono text-[12px]">{r.entity}/{r.entity_id ?? "—"}</td>
              <td className="px-4 py-3">{meta.result ?? "—"}{meta.reason ? ` · ${meta.reason}` : ""}</td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
