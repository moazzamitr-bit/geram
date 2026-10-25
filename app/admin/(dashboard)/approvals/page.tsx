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
        title="شارژ و موجودی"
        description="همان ادمین که فرم را می‌فرستد، ژورنال را همان لحظه در دفترکل ثبت می‌کند. جدول wallets مستقیم عوض نمی‌شود."
      />
      {!rows.ready ? <OpsBadge state="NOT_READY" /> : <OpsBadge state="SANDBOX" />}
      <AdminNotice title="موجودی اولیه خزانه">
        ثبت فلز یا نقدینگی عملیاتی، ژورنال APPROVED_OPENING_BALANCE را همان لحظه به PLATFORM_AVAILABLE یا PLATFORM_CASH_CONTROL پست می‌کند. تکرار همان درخواست دوباره اعمال نمی‌شود.
      </AdminNotice>
      <AdminNotice title="شارژ کیف پول">
        ثبت فرم شارژ، ژورنال APPROVED_OPENING_BALANCE را همان لحظه به USER_AVAILABLE پست می‌کند. جدول wallets عوض نمی‌شود.
      </AdminNotice>
      <div className="mb-6 max-w-lg">
        <InventoryRequestForm />
      </div>
      <div className="mb-6 max-w-lg">
        <WalletCreditForm />
      </div>
      {rows.ready ? (
        <AdminTable headers={["نوع", "وضعیت", "ثبت‌کننده", "تأییدکننده", "زمان", "اقدام"]} empty={rows.rows.length === 0}>
          {rows.rows.map((r) => (
            <tr key={String(r.id)} className="border-b border-white/5 align-top">
              <td className="px-4 py-3">
                {String(r.kind)}
                {r.kind === "INVENTORY_ADJUSTMENT" && (
                  <span className="block text-[11px] text-white/65" dir="ltr">
                    {String((r.payload as { asset?: string })?.asset ?? "")}{" "}
                    {String((r.payload as { amount?: string })?.amount ?? "")}
                  </span>
                )}
                {r.kind === "FINANCIAL_ADJUSTMENT" && (
                  <span className="block text-[11px] text-white/65" dir="ltr">
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
                {r.kind === "FINANCIAL_ADJUSTMENT" ? (
                  <>
                    {r.status === "PENDING_APPROVAL" && (
                      <AdminActionForm action="reject" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="رد شارژ باز" danger />
                    )}
                    {(r.status === "PENDING_APPROVAL" || r.status === "APPROVED") && (
                      <AdminActionForm action="execute" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="ثبت در دفترکل" />
                    )}
                  </>
                ) : (
                  <>
                    {r.status === "PENDING_APPROVAL" && r.kind !== "INVENTORY_ADJUSTMENT" && (
                      <AdminActionForm action="approve" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="تأیید" />
                    )}
                    {r.kind === "INVENTORY_ADJUSTMENT" &&
                      (r.status === "PENDING_APPROVAL" || r.status === "APPROVED") && (
                        <AdminActionForm action="execute" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="ثبت در دفترکل" />
                      )}
                    {r.kind !== "INVENTORY_ADJUSTMENT" && r.status === "APPROVED" && (
                      <AdminActionForm action="execute" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="اجرا" />
                    )}
                    {(r.status === "PENDING_APPROVAL" || r.status === "APPROVED") && (
                      <AdminActionForm action="reject" endpoint="/api/admin/approvals" extra={{ id: String(r.id) }} submitLabel="رد" danger />
                    )}
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
