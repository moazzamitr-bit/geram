import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { getTransaction } from "@/lib/admin/queries";
import { probeTable } from "@/lib/admin/probe";
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
  const core = await probeTable<Record<string, unknown>>("core_trades", "*", { eq: ["id", id], limit: 1 });
  const legacy = await getTransaction(id);
  const row = core.rows[0];
  if (!row && !legacy) notFound();

  const profile = legacy
    ? Array.isArray(legacy.profiles)
      ? legacy.profiles[0]
      : legacy.profiles
    : null;

  return (
    <div>
      <AdminPageHeader
        title="جزئیات معامله"
        description="تغییر وضعیت settled مجاز نیست."
      />
      <AdminNotice title="اقدامات">
        به‌طور معمول هیچ اقدام مالی نیست. Retry اعلان غیرمالی و باز کردن حادثه مجاز است.
      </AdminNotice>
      <div className="mb-6 rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[13px] leading-7">
        {row ? (
          <>
            <p>Trade ID: <span className="font-mono" dir="ltr">{String(row.id)}</span></p>
            <p>User: <Link className="text-gold" href={`/admin/users/${row.user_id}`}>{String(row.user_id)}</Link></p>
            <p>Asset / Side: {String(row.asset)} / {String(row.side)}</p>
            <p>Quote: {String(row.quote_id)}</p>
            <p>Weight: {String(row.weight_ug)} µg</p>
            <p>Gross / Fee / Net: {formatToman(Number(row.gross_irr))} / {formatToman(Number(row.fee_irr))} / {formatToman(Number(row.net_irr))}</p>
            <p>Status: <AdminBadge>{String(row.status)}</AdminBadge></p>
            <p>Idempotency: <span className="font-mono">{String(row.idempotency_key)}</span></p>
            <p>Tracking: {String(row.tracking_code)}</p>
            <p>Outbox / Correlation: داده در دسترس نیست مگر core_outbox اعمال شده باشد</p>
          </>
        ) : (
          <>
            <p>کد: <span className="font-mono">{legacy!.tracking_code}</span></p>
            <p>
              کاربر:{" "}
              <Link className="text-gold" href={`/admin/users/${legacy!.user_id}`}>
                {profile
                  ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone)
                  : legacy!.user_id}
              </Link>
            </p>
            <p>نوع: {legacy!.type} · دارایی: {legacy!.instrument ?? "gold18"}</p>
            <p>مبلغ: {formatToman(Number(legacy!.amount_toman))} · کارمزد: {formatToman(Number(legacy!.fee_toman))}</p>
            <p>قیمت مرجع: {formatToman(Number(legacy!.price_per_gram_toman))} / گرم</p>
            <p>وزن: {(Number(legacy!.gold_mg) / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم</p>
            <p>وضعیت: <AdminBadge>{legacy!.status}</AdminBadge></p>
            <p>ژورنال / نقل‌قول / outbox: NOT READY (میراث transactions)</p>
          </>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <AdminActionForm
          action="create"
          endpoint="/api/admin/incidents"
          extra={{ kind: "PAYMENT_MISMATCH", correlationId: id }}
          submitLabel="باز کردن حادثه"
        />
        <p className="text-[13px] text-white/50">
          مشاهده تطبیق: <Link className="text-gold" href="/admin/reconciliation">مرکز تطبیق</Link>
        </p>
      </div>
    </div>
  );
}
