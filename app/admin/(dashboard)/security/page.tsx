import {
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { listAudit } from "@/lib/admin/audit";
import { maskEmail } from "@/lib/admin/mask";

const SECURITY_ACTIONS = [
  "session.revoke_all",
  "permission.denied",
  "kill_switch.update",
  "admin.role.assign",
  "kyc.approve",
];

export default async function AdminSecurityPage() {
  const rows = await listAudit(300);
  const filtered = rows.filter((r) =>
    SECURITY_ACTIONS.some((a) => String(r.action).startsWith(a.split(".")[0]) || String(r.action) === a)
  );

  return (
    <div>
      <AdminPageHeader
        title="مرکز امنیت"
        description="PII ماسک‌شده. شکست ورود/OTP abuse اگر جدول جدا نباشد از audit ادمین نشان داده می‌شود."
      />
      <AdminNotice title="محدودیت">
        login failures / OTP abuse / refresh-token reuse نیازمند جدول رویداد امنیتی کاربر است — فعلاً NOT READY.
        اقدامات ممتاز ادمین از audit_logs خوانده می‌شود.
      </AdminNotice>
      <div className="mb-4"><OpsBadge state="DEGRADED" /></div>
      <AdminTable headers={["زمان", "کنش", "بازیگر", "هدف", "نتیجه"]} empty={filtered.length === 0}>
        {filtered.map((r) => {
          const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return (
            <tr key={r.id} className="border-b border-white/5">
              <td className="px-4 py-3 text-white/45">{new Date(r.created_at).toLocaleString("fa-IR")}</td>
              <td className="px-4 py-3 font-mono text-[12px]">{r.action}</td>
              <td className="px-4 py-3">{maskEmail(profile?.email) || r.actor_id?.slice(0, 8)}</td>
              <td className="px-4 py-3 font-mono text-[12px]">{r.entity}/{r.entity_id ?? "—"}</td>
              <td className="px-4 py-3">{(r.meta as { result?: string } | null)?.result ?? "—"}</td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
