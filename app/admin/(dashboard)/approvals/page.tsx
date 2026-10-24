import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { InventoryRequestForm } from "@/components/admin/InventoryRequestForm";
import { WalletCreditForm } from "@/components/admin/WalletCreditForm";
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
        description="شارژ کیف پول با یک ادمین همان لحظه در دفترکل می‌نشیند. برای موجودی اولیه خزانه و بقیه درخواست‌ها، سازنده نمی‌تواند درخواست خودش را تأیید کند. اجرا فقط از ژورنال است."
      />
      {!rows.ready ? <OpsBadge state="NOT_READY" /> : <OpsBadge state="SANDBOX" />}
      <AdminNotice title="موجودی اولیه خزانه">
        ثبت موجودی اولیه فلز یا نقدینگی عملیاتی صف تأیید می‌سازد. Execute ژورنال APPROVED_OPENING_BALANCE را به PLATFORM_AVAILABLE یا PLATFORM_CASH_CONTROL پست می‌کند.
      </AdminNotice>
      <AdminNotice title="شارژ کیف پول">
        شارژ کاربر تأیید ادمین دوم نمی‌خواهد. ثبت فرم، ژورنال APPROVED_OPENING_BALANCE را همان لحظه به USER_AVAILABLE پست می‌کند و در لاگ حسابرسی می‌ماند. درخواست قدیمیِ در صف را همان ادمین با «اعمال شارژ» تمام می‌کند. جدول wallets عوض نمی‌شود.
      </AdminNotice>
      <div className="mb-6 max-w-lg">
        <InventoryRequestForm />
      </div>
      <div className="mb-6 max-w-lg">
        <WalletCreditForm />
      </div>
      {rows.ready ? (
        <AdminTable headers={["نوع", "وضعیت", "maker", "checker", "زمان", "اقدام"]} empty={rows.rows.length === 0}>
          {rows.rows.map((r) => (
            <tr key={String(r.id)} className="border-b border-white/5 align-top">
              <td className="px-4 py-3">
                {String(r.kind)}
                {r.kind === "INVENTORY_ADJUSTMENT" && (
                  <span className="block text-[11px] text-white/50" dir="ltr">
                    {String((r.payload as { asset?: string })?.asset ?? "")}{" "}
                    {String((r.payload as { amount?: string })?.amount ?? "")}
                  </span>
                )}
                {r.kind === "FINANCIAL_ADJUSTMENT" && (
                  <span className="block text-[11px] text-white/50" dir="ltr">
                    {String((r.payload as { userId?: string })?.userId ?? "").slice(0, 8)}{" "}
                    {String((r.payload as { amount?: string })?.amount ?? "")} IRR-toman
                  </span>
                )}
              </td>
              <td className="px-4 py-3"><AdminBadge>{String(r.status)}</AdminBadge></td>
              <td className="px-4 py-3 font-mono text-[12px]">{String(r.maker_id ?? "—").slice(0, 8)}</td>
              <td className="px-4 py-3 font-mono text-[12px]">{String(r.checker_id ?? "—").slice(0, 8)}</td>
              <td className="px-4 py-3 text-white/45">{new Date(String(r.created_at)).toLocaleString("fa-IR")}</td>
              <td className="px-4 py-3 min-w-[220px] space-y-2">
                {String(r.status) === "EXECUTED" || String(r.status) === "REJECTED" ? (
                  <span className="text-[12px] text-white/40">تمام شده</span>
                ) : r.kind === "FINANCIAL_ADJUSTMENT" ? (
                  <>
                    {String(r.status) === "APPROVED" ? (
                      <AdminActionForm action="execute" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="تلاش دوباره ژورنال" />
                    ) : (
                      <AdminActionForm action="approve" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="اعمال شارژ" />
                    )}
                    <AdminActionForm action="reject" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="رد" danger />
                  </>
                ) : (
                  <>
                    <AdminActionForm action="approve" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="Approve" />
                    <AdminActionForm action="reject" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="Reject" danger />
                    <AdminActionForm action="execute" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="Execute journal" />
                  </>
                )}
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
