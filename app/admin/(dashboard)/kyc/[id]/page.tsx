import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { getProfile } from "@/lib/admin/queries";
import { maskEmail, maskPhone } from "@/lib/admin/mask";
import { finnotechConfigured } from "@/lib/finnotech/config";
import { maskNationalCode } from "@/lib/kyc/national-id";
import { notFound } from "next/navigation";
import Link from "next/link";

function when(value: unknown) {
  if (!value || typeof value !== "string") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fa-IR");
}

export default async function AdminKycDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";
  const row = profile as typeof profile & {
    father_name?: string | null;
    national_code?: string | null;
    kyc_birth_date?: string | null;
    kyc_verified_at?: string | null;
    kyc_checked_at?: string | null;
    kyc_provider?: string | null;
    kyc_track_id?: string | null;
  };
  const configured = finnotechConfigured();

  return (
    <div>
      <AdminPageHeader
        title={`KYC · ${name}`}
        description="نام از استعلام ثبت احوال است. کد ملی کامل در لاگ نوشته نمی‌شود."
        action={<AdminBadge>{profile.kyc_status}</AdminBadge>}
      />
      <AdminNotice title="فینوتک">
        {row.kyc_provider === "finnotech"
          ? "این پرونده از فینوتک تأیید یا بررسی شده است. «استعلام دوباره» فقط ثبت احوال را تکرار می‌کند و پیامک شاهکار جدید نمی‌فرستد."
          : configured
            ? "فینوتک وصل است. تا کاربر کد ملی را در پنل خودش بفرستد، نتیجه شاهکار روی این پرونده نیست."
            : "کلید فینوتک تنظیم نشده. استعلام زنده انجام نمی‌شود."}
      </AdminNotice>
      <div className="mb-6 rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[13px] leading-7">
        <p>کاربر: <Link className="text-gold" href={`/admin/users/${id}`}>{name}</Link></p>
        <p>نام پدر: {row.father_name || "—"}</p>
        <p>تماس: <span dir="ltr">{maskPhone(profile.phone)} · {maskEmail(profile.email)}</span></p>
        <p>کد ملی: <span dir="ltr">{row.national_code ? maskNationalCode(row.national_code) : "—"}</span></p>
        <p>تاریخ تولد استعلام: <span dir="ltr">{row.kyc_birth_date || "—"}</span></p>
        <p>سرویس: {row.kyc_provider || "—"}</p>
        <p>شناسه پیگیری: <span dir="ltr">{row.kyc_track_id || "—"}</span></p>
        <p>زمان تأیید: {when(row.kyc_verified_at)}</p>
        <p>آخرین بررسی: {when(row.kyc_checked_at)}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <AdminActionForm action="retry_provider" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="استعلام دوباره ثبت احوال" />
        <AdminActionForm action="request_resubmission" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="درخواست ارسال مجدد" />
        <AdminActionForm action="manual_review" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="ارسال به بررسی دستی" />
        <AdminActionForm action="approve" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="تأیید سیاست‌مند (SUPER_ADMIN)" />
        <AdminActionForm action="reject" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="رد با دلیل" danger />
        <AdminActionForm action="escalate" endpoint="/api/admin/kyc" extra={{ userId: id }} submitLabel="Escalation" />
      </div>
    </div>
  );
}
