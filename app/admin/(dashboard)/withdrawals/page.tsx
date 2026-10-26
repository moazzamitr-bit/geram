import { AdminBadge, AdminNotice, AdminPageHeader, AdminTable } from "@/components/admin/AdminUI";
import { WithdrawalActions } from "@/components/admin/WithdrawalActions";
import { maskPhone } from "@/lib/admin/mask";
import { formatToman } from "@/lib/utils";
import { listAllWithdrawals, withdrawalsEnabled } from "@/lib/withdraw/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS = {
  PENDING: { label: "در انتظار واریز", tone: "warning" },
  PAID: { label: "واریز شد", tone: "positive" },
  REJECTED: { label: "رد شد", tone: "negative" },
  CANCELLED: { label: "لغو کاربر", tone: "neutral" },
} as const;

export default async function AdminWithdrawalsPage() {
  const rows = await listAllWithdrawals().catch(() => []);
  const pending = rows.filter((r) => r.status === "PENDING");
  const pendingToman = pending.reduce((s, r) => s + Number(r.amount_irr) / 10, 0);
  return (
    <div>
      <AdminPageHeader
        title="برداشت تومانی"
        description="مبلغ هر درخواست در دفترکل رزرو است. بعد از واریز پایا/ساتنا به همان شبا، شماره پیگیری را ثبت کنید؛ رد کردن، مبلغ را به کیف پول کاربر برمی‌گرداند."
      />
      <AdminNotice title={withdrawalsEnabled() ? "صف واریز" : "برداشت خاموش است (WITHDRAWAL_ENABLED)"}>
        {pending.length.toLocaleString("fa-IR")} درخواست در انتظار، جمع {formatToman(pendingToman)}. واریز فقط به شبای
        کارتی که مالکیتش با فینوتک تأیید شده و شبایش از استعلام کارت‌به‌شبا آمده.
      </AdminNotice>
      <AdminTable
        headers={["کد", "کاربر", "مبلغ واریز", "کارمزد", "مقصد", "وضعیت", "زمان", "اقدام"]}
        empty={rows.length === 0}
      >
        {rows.map((r) => {
          const st = STATUS[r.status];
          return (
            <tr key={r.id} className="border-b border-white/5 align-top">
              <td className="px-4 py-3 font-mono text-[12px]">{r.tracking_code}</td>
              <td className="px-4 py-3">
                <Link className="text-gold" href={`/admin/users/${r.user_id}`}>
                  {r.full_name || maskPhone(r.phone)}
                </Link>
              </td>
              <td className="px-4 py-3 font-bold">{formatToman(Number(r.amount_irr) / 10)}</td>
              <td className="px-4 py-3">{formatToman(Number(r.fee_irr) / 10)}</td>
              <td className="px-4 py-3">
                <p>{r.bank_name}</p>
                <p dir="ltr" className="font-mono text-[12px]">{r.iban}</p>
                <p dir="ltr" className="font-mono text-[11px] text-white/45">{r.pan_masked}</p>
              </td>
              <td className="px-4 py-3">
                <AdminBadge tone={st.tone}>{st.label}</AdminBadge>
                {r.payout_ref ? <p dir="ltr" className="mt-1 font-mono text-[11px] text-white/60">ref {r.payout_ref}</p> : null}
                {r.admin_note ? <p className="mt-1 text-[11px] text-white/45">{r.admin_note}</p> : null}
              </td>
              <td className="px-4 py-3 text-white/45">{new Date(r.created_at).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}</td>
              <td className="px-4 py-3">{r.status === "PENDING" ? <WithdrawalActions id={r.id} /> : "—"}</td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
