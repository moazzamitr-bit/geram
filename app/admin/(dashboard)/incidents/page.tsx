import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { probeTable } from "@/lib/admin/probe";

const KINDS = [
  "CUSTODY_DEFICIT",
  "STALE_CUSTODY",
  "PRICE_DISAGREEMENT",
  "LEDGER_MISMATCH",
  "PAYMENT_MISMATCH",
  "PAYOUT_UNKNOWN",
  "INVENTORY_DEFICIT",
];

export default async function AdminIncidentsPage() {
  const rows = await probeTable<Record<string, unknown>>("admin_incidents", "*", {
    order: "opened_at",
    limit: 200,
  });
  return (
    <div>
      <AdminPageHeader title="حوادث اعتماد / پوشش" description="OPEN → INVESTIGATING → MITIGATED → RESOLVED" />
      {!rows.ready ? <OpsBadge state="NOT_READY" /> : <OpsBadge state="SANDBOX" />}
      <AdminNotice title="جدول">
        {!rows.ready ? rows.error ?? "admin_incidents اعمال نشده." : "حوادث ثبت‌شده از عملیات."}
      </AdminNotice>
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {KINDS.map((kind) => (
          <AdminActionForm
            key={kind}
            action="create"
            endpoint="/api/admin/incidents"
            extra={{ kind }}
            submitLabel={`باز کردن ${kind}`}
          />
        ))}
      </div>
      {rows.ready ? (
        <AdminTable headers={["نوع", "شدت", "وضعیت", "دارایی", "زمان", "اقدام"]} empty={rows.rows.length === 0}>
          {rows.rows.map((r) => (
            <tr key={String(r.id)} className="border-b border-white/5 align-top">
              <td className="px-4 py-3">{String(r.kind)}</td>
              <td className="px-4 py-3">{String(r.severity)}</td>
              <td className="px-4 py-3"><AdminBadge>{String(r.status)}</AdminBadge></td>
              <td className="px-4 py-3">{String(r.asset ?? "—")}</td>
              <td className="px-4 py-3 text-white/45">{new Date(String(r.opened_at)).toLocaleString("fa-IR")}</td>
              <td className="px-4 py-3 min-w-[220px] space-y-2">
                <AdminActionForm action="investigate" endpoint="/api/admin/incidents" extra={{ id: String(r.id) }} submitLabel="Investigating" />
                <AdminActionForm action="mitigate" endpoint="/api/admin/incidents" extra={{ id: String(r.id) }} submitLabel="Mitigated" />
                <AdminActionForm action="resolve" endpoint="/api/admin/incidents" extra={{ id: String(r.id) }} submitLabel="Resolved" />
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : null}
    </div>
  );
}
