import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { probeTable } from "@/lib/admin/probe";

export default async function AdminApprovalsPage() {
  const rows = await probeTable<Record<string, unknown>>("admin_approval_requests", "*", {
    order: "created_at",
    limit: 200,
  });
  return (
    <div>
      <AdminPageHeader
        title="تأیید دو مرحله‌ای"
        description="سازنده نمی‌تواند درخواست خودش را تأیید کند. اجرای اصلاح مالی فقط از ژورنال — هرگز mutation مستقیم موجودی."
      />
      {!rows.ready ? <OpsBadge state="NOT_READY" /> : <OpsBadge state="SANDBOX" />}
      <AdminNotice title="AdjustmentRequest">
        ایجاد اصلاح مالی صف تأیید می‌سازد. Execute وقتی دفترکل عملیاتی نباشد رد می‌شود و wallets را عوض نمی‌کند.
      </AdminNotice>
      <div className="mb-6 max-w-lg">
        <AdminActionForm
          action="create"
          endpoint="/api/admin/approvals"
          extra={{ kind: "FINANCIAL_ADJUSTMENT" }}
          submitLabel="درخواست اصلاح مالی (نه Edit Balance)"
        />
      </div>
      {rows.ready ? (
        <AdminTable headers={["نوع", "وضعیت", "maker", "checker", "زمان", "اقدام"]} empty={rows.rows.length === 0}>
          {rows.rows.map((r) => (
            <tr key={String(r.id)} className="border-b border-white/5 align-top">
              <td className="px-4 py-3">{String(r.kind)}</td>
              <td className="px-4 py-3"><AdminBadge>{String(r.status)}</AdminBadge></td>
              <td className="px-4 py-3 font-mono text-[12px]">{String(r.maker_id ?? "—").slice(0, 8)}</td>
              <td className="px-4 py-3 font-mono text-[12px]">{String(r.checker_id ?? "—").slice(0, 8)}</td>
              <td className="px-4 py-3 text-white/45">{new Date(String(r.created_at)).toLocaleString("fa-IR")}</td>
              <td className="px-4 py-3 min-w-[220px] space-y-2">
                <AdminActionForm action="approve" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="Approve" />
                <AdminActionForm action="reject" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="Reject" danger />
                <AdminActionForm action="execute" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="Execute journal" />
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <p className="text-[13px] text-white/45">{rows.error}</p>
      )}
    </div>
  );
}
