import { AdminNotice, AdminPageHeader, OpsBadge } from "@/components/admin/AdminUI";

export default function AdminSessionsPage() {
  return (
    <div>
      <AdminPageHeader
        title="نشست‌ها و دستگاه"
        description="جدول دستگاه اپلیکیشن در این فاز وجود ندارد. لغو سراسری از صفحه کاربر ۳۶۰ ممکن است."
      />
      <AdminNotice title="NOT READY">
        لیست active sessions / device name / trusted flag از auth.sessions در کنسول در دسترس نیست.
        اقدام مجاز: revoke all از User 360 با دلیل و audit.
      </AdminNotice>
      <OpsBadge state="NOT_READY" />
    </div>
  );
}
