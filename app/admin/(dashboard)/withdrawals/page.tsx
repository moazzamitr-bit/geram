import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { listTransactionsFiltered } from "@/lib/admin/queries";
import { formatToman } from "@/lib/utils";
import { maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

export default async function AdminWithdrawalsPage() {
  const rows = await listTransactionsFiltered({ type: "برداشت", limit: 200 });
  return (
    <div>
      <AdminPageHeader
        title="برداشت / پرداخت"
        description="Mark Paid وجود ندارد. UNKNOWN باید رزرو بماند."
        action={<a className="text-[13px] text-gold" href="/api/admin/export?type=withdrawals">CSV</a>}
      />
      <OpsBadge state="NOT_READY" />
      <AdminNotice title="Payout provider">
        گردش REQUESTED → RESERVED → PROVIDER_PENDING هنوز ساخته نشده. فهرست زیر میراث «برداشت» است.
        لغو فقط قبل از ارسال خارجی وقتی workflow آماده شود.
      </AdminNotice>
      <AdminTable headers={["کد", "کاربر", "مبلغ", "وضعیت", "زمان", "اقدام"]} empty={rows.length === 0}>
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
              <td className="px-4 py-3 text-white/45">{new Date(t.created_at).toLocaleString("fa-IR")}</td>
              <td className="px-4 py-3 min-w-[220px]">
                <AdminActionForm
                  action="create"
                  endpoint="/api/admin/incidents"
                  extra={{ kind: "PAYOUT_UNKNOWN", correlationId: t.id }}
                  submitLabel="باز کردن حادثه"
                />
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
