import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { listReferralEvents } from "@/lib/db/admin-queries";
import { formatToman } from "@/lib/utils";
import { getExecutionMode, getFeatureFlags } from "@/lib/core/mode";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";

export default async function AdminReferralsPage() {
  const [rows, settings] = await Promise.all([
    listReferralEvents(100),
    loadCommerceSettings(),
  ]);
  const share = settings.referral.feeSharePercent;
  let enabled = false;
  try {
    enabled = getFeatureFlags(getExecutionMode()).REFERRAL_ENABLED;
  } catch {
    enabled = false;
  }

  return (
    <div>
      <AdminPageHeader
        title="دعوت دوستان"
        description={`مدل سهم از کارمزد: ${Math.round(share * 100)}٪ کارمزد معاملات دعوت‌شده به دعوت‌کننده تعلق می‌گیرد. پرداخت هنوز به دفترکل متصل نیست.`}
      />
      <OpsBadge state={enabled ? "SANDBOX" : "NOT_READY"} />
      <AdminNotice title="REFERRAL_ENABLED">{String(enabled)}</AdminNotice>
      <AdminTable
        headers={[
          "دعوت‌کننده",
          "دعوت‌شده",
          "پاداش دعوت‌کننده",
          "پاداش دعوت‌شده",
          "کارمزد معاملات دعوت‌شده",
          "سهم دعوت‌کننده",
          "وضعیت",
          "تاریخ",
        ]}
        empty={rows.length === 0}
      >
        {rows.map((r) => {
          const inviter = Array.isArray(r.inviter) ? r.inviter[0] : r.inviter;
          const invitee = Array.isArray(r.invitee) ? r.invitee[0] : r.invitee;
          return (
            <tr key={r.id} className="border-t border-white/5">
              <td className="px-4 py-3 text-[13px]">
                {inviter?.first_name} {inviter?.last_name}
                <span className="block font-mono text-[11px] text-white/45" dir="ltr">
                  {inviter?.referral_code}
                </span>
              </td>
              <td className="px-4 py-3 text-[13px]">
                {invitee?.first_name} {invitee?.last_name}
                <span className="block text-[11px] text-white/45">{invitee?.phone}</span>
              </td>
              <td className="px-4 py-3 tabular-nums text-[13px]">
                {formatToman(Number(r.inviter_bonus_toman))}
              </td>
              <td className="px-4 py-3 tabular-nums text-[13px]">
                {formatToman(Number(r.invitee_bonus_toman))}
              </td>
              <td className="px-4 py-3 tabular-nums text-[13px]">
                {formatToman(r.inviteeFeesToman)}
              </td>
              <td className="px-4 py-3 tabular-nums text-[13px] text-gold">
                {formatToman(Math.floor(r.inviteeFeesToman * share))}
              </td>
              <td className="px-4 py-3">
                <AdminBadge
                  tone={
                    r.status === "PAID"
                      ? "positive"
                      : r.status === "REJECTED"
                        ? "negative"
                        : "warning"
                  }
                >
                  {r.status}
                </AdminBadge>
              </td>
              <td className="px-4 py-3 text-[12px] text-white/50">
                {new Date(r.created_at).toLocaleString("fa-IR")}
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
