import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { probeTable } from "@/lib/admin/probe";

export default async function AdminReconciliationPage() {
  const items = await probeTable<Record<string, unknown>>("admin_reconciliation_items", "*", {
    order: "detected_at",
    limit: 200,
  });

  return (
    <div>
      <AdminPageHeader
        title="مرکز تطبیق"
        description="اصلاح مالی فقط maker-checker. Credit Wallet / Mark Paid وجود ندارد."
        action={<a className="text-[13px] text-gold" href="/api/admin/export?type=reconciliation">CSV</a>}
      />
      {!items.ready ? (
        <>
          <OpsBadge state="NOT_READY" />
          <AdminNotice title="موتور تطبیق">
            جدول admin_reconciliation_items اعمال نشده. انواع هدف: PAYMENT, PAYOUT, LEDGER_BALANCE, TREASURY, CUSTODY, PROCUREMENT, CASH.
          </AdminNotice>
        </>
      ) : (
        <>
          <OpsBadge state="SANDBOX" />
          <AdminTable
            headers={["نوع", "وضعیت", "شدت", "منبع/هدف", "delta", "زمان", "اقدام"]}
            empty={items.rows.length === 0}
          >
            {items.rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-white/5 align-top">
                <td className="px-4 py-3">{String(r.kind)}</td>
                <td className="px-4 py-3"><AdminBadge>{String(r.status)}</AdminBadge></td>
                <td className="px-4 py-3">{String(r.severity)}</td>
                <td className="px-4 py-3 text-[12px]">{String(r.source ?? "—")} → {String(r.target ?? "—")}</td>
                <td className="px-4 py-3">{String(r.delta ?? "—")}</td>
                <td className="px-4 py-3 text-white/45">{new Date(String(r.detected_at)).toLocaleString("fa-IR")}</td>
                <td className="px-4 py-3 min-w-[220px] space-y-2">
                  <AdminActionForm action="assign" endpoint="/api/admin/reconciliation" extra={{ id: String(r.id) }} submitLabel="Assign" />
                  <AdminActionForm action="note" endpoint="/api/admin/reconciliation" extra={{ id: String(r.id) }} submitLabel="یادداشت" />
                  <AdminActionForm action="escalate" endpoint="/api/admin/reconciliation" extra={{ id: String(r.id) }} submitLabel="Escalation" />
                  <AdminActionForm action="resolve" endpoint="/api/admin/reconciliation" extra={{ id: String(r.id) }} submitLabel="Resolve (غیرمالی)" />
                </td>
              </tr>
            ))}
          </AdminTable>
        </>
      )}
    </div>
  );
}
