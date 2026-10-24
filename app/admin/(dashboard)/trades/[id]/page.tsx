import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { isClosedBetaInactiveAdminPath } from "@/lib/admin/closed-beta";
import { getAdminActivity } from "@/lib/admin/ledger-activity";
import { probeCount } from "@/lib/admin/probe";
import { formatToman } from "@/lib/utils";
import { maskPhone } from "@/lib/admin/mask";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminTradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getAdminActivity(id);
  if (!row) notFound();
  const outbox = await probeCount("core_outbox");
  const profile = row.profiles;

  return (
    <div>
      <AdminPageHeader
        title="جزئیات فعالیت دفترکل"
        description="تغییر وضعیت settled مجاز نیست."
      />
      <AdminNotice title="اقدامات">
        به‌طور معمول هیچ اقدام مالی نیست. باز کردن حادثه مجاز است.
      </AdminNotice>
      <div className="mb-6 rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[13px] leading-7">
        <p>شناسه: <span className="font-mono" dir="ltr">{row.id}</span></p>
        <p>کد: <span className="font-mono">{row.tracking_code}</span></p>
        <p>
          کاربر:{" "}
          <Link className="text-gold" href={`/admin/users/${row.user_id}`}>
            {profile
              ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone)
              : row.user_id}
          </Link>
        </p>
        <p>نوع: {row.type} · دارایی: {row.instrument ?? "—"}</p>
        <p>مبلغ: {formatToman(row.amount_toman)} · کارمزد: {formatToman(row.fee_toman)}</p>
        <p>وزن: {(row.gold_mg / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم</p>
        <p>وضعیت: <AdminBadge>{row.status}</AdminBadge></p>
        {row.payment_ref ? <p>مرجع: {row.payment_ref}</p> : null}
        {row.note ? <p>دلیل: {row.note}</p> : null}
        <p>
          صف outbox:{" "}
          {outbox.ready ? `${outbox.count ?? 0} پردازش‌نشده` : outbox.error ?? "در دسترس نیست"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <AdminActionForm
          action="create"
          endpoint="/api/admin/incidents"
          extra={{ kind: "PAYMENT_MISMATCH", correlationId: id }}
          submitLabel="باز کردن حادثه"
        />
        {!isClosedBetaInactiveAdminPath("/admin/reconciliation") ? (
          <p className="text-[13px] text-white/50">
            مشاهده تطبیق: <Link className="text-gold" href="/admin/reconciliation">مرکز تطبیق</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
