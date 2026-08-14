import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { getProfile } from "@/lib/admin/queries";
import { maskEmail, maskPhone } from "@/lib/admin/mask";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function AdminKycDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";

  return (
    <div>
      <AdminPageHeader
        title={`KYC · ${name}`}
        description="PII ماسک‌شده. تأیید آزادانه بدون سیاست مجاز نیست."
        action={<AdminBadge>{profile.kyc_status}</AdminBadge>}
      />
      <AdminNotice title="Provider">
        identity / mobile ownership / bank ownership: NOT READY. خلاصه پاسخ فروشنده موجود نیست.
      </AdminNotice>
      <div className="mb-6 rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[13px] leading-7">
        <p>کاربر: <Link className="text-gold" href={`/admin/users/${id}`}>{name}</Link></p>
        <p>تماس: <span dir="ltr">{maskPhone(profile.phone)} · {maskEmail(profile.email)}</span></p>
        <p>آخرین بررسی فروشنده: داده در دسترس نیست</p>
        <p>تعداد تلاش: داده در دسترس نیست</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <AdminActionForm action="retry_provider" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="Retry provider (ثبت audit)" />
        <AdminActionForm action="request_resubmission" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="درخواست ارسال مجدد" />
        <AdminActionForm action="manual_review" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="ارسال به بررسی دستی" />
        <AdminActionForm action="approve" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="تأیید سیاست‌مند (SUPER_ADMIN)" />
        <AdminActionForm action="reject" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="رد با دلیل" danger />
        <AdminActionForm action="escalate" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="Escalation" />
      </div>
    </div>
  );
}
