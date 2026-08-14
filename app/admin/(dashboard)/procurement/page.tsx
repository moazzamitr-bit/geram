import { AdminNotice, AdminPageHeader, OpsBadge } from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";

export default function AdminProcurementPage() {
  return (
    <div>
      <AdminPageHeader
        title="تأمین"
        description="Auto-procurement در MVP نیست. ارسال واقعی به تأمین‌کننده نیازمند maker-checker است."
      />
      <OpsBadge state="NOT_READY" />
      <AdminNotice title="تأمین‌کنندگان / سفارش‌ها">
        جداول Suppliers و ProcurementOrder هنوز ساخته نشده‌اند. وضعیت‌های هدف DRAFT → PENDING_APPROVAL → APPROVED → SUBMITTED.
      </AdminNotice>
      <AdminActionForm
        action="create"
        endpoint="/api/admin/approvals"
        extra={{ kind: "PROCUREMENT_SUBMIT" }}
        submitLabel="ثبت پیشنهاد تأمین (صف تأیید)"
      />
    </div>
  );
}
