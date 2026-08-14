import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { listTransactionsFiltered } from "@/lib/admin/queries";
import { probeTable } from "@/lib/admin/probe";
import { formatToman } from "@/lib/utils";
import { maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

export default async function AdminDepositsPage() {
  const rows = await listTransactionsFiltered({ type: "واریز", limit: 200 });
  const sandbox = await probeTable<Record<string, unknown>>("core_sandbox_deposits", "*", {
    order: "created_at",
    limit: 100,
  });

  return (
    <div>
      <AdminPageHeader
        title="صف واریز"
        description="Credit Wallet وجود ندارد. اعتبار مالی فقط از workflow تأییدشده بک‌اند."
        action={<a className="text-[13px] text-gold" href="/api/admin/export?type=deposits">CSV</a>}
      />
      <OpsBadge state="MOCK" />
      <AdminNotice title="PSP">
        واریز واقعی PROVIDER_SUCCESS / LEDGER_POSTED پیاده نشده. وضعیت‌های آینده روی این صفحه آماده نمایش‌اند ولی منبع فعلی جدول میراث «واریز» و sandbox deposits است.
      </AdminNotice>
      <AdminTable headers={["کد", "کاربر", "مبلغ", "وضعیت", "رفرنس", "زمان", "اقدام"]} empty={rows.length === 0}>
        {rows.map((t) => {
          const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
          return (
            <tr key={t.id} className="border-b border-white/5 align-top">
              <td className="px-4 py-3 font-mono text-[12px]">{t.tracking_code}</td>
              <td className="px-4 py-3">
                <Link className="text-gold" href={`/admin/users/${t.user_id}`}>
                  {profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone) : "—"}
                </Link>
              </td>
              <td className="px-4 py-3">{formatToman(Number(t.amount_toman))}</td>
              <td className="px-4 py-3"><AdminBadge tone="warning">{t.status}</AdminBadge></td>
              <td className="px-4 py-3 font-mono text-[12px]">{t.payment_ref ?? "—"}</td>
              <td className="px-4 py-3 text-white/45">{new Date(t.created_at).toLocaleString("fa-IR")}</td>
              <td className="px-4 py-3 min-w-[220px]">
                <AdminActionForm
                  action="create"
                  endpoint="/api/admin/incidents"
                  extra={{ kind: "PAYMENT_MISMATCH", correlationId: t.id }}
                  submitLabel="علامت تحقیق دستی"
                />
              </td>
            </tr>
          );
        })}
      </AdminTable>
      <h2 className="mt-8 mb-3 font-bold">Sandbox deposits</h2>
      {sandbox.ready ? (
        <AdminTable headers={["id", "user", "IRR", "کد"]} empty={sandbox.rows.length === 0}>
          {sandbox.rows.map((d) => (
            <tr key={String(d.id)} className="border-b border-white/5">
              <td className="px-4 py-3 font-mono text-[12px]">{String(d.id).slice(0, 10)}</td>
              <td className="px-4 py-3 font-mono text-[12px]">{String(d.user_id).slice(0, 8)}</td>
              <td className="px-4 py-3">{formatToman(Number(d.irr))}</td>
              <td className="px-4 py-3">{String(d.tracking_code)}</td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <p className="text-[13px] text-white/45">core_sandbox_deposits: NOT READY</p>
      )}
    </div>
  );
}
