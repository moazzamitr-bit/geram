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

export default async function AdminReferralsPage() {
  const rows = await listReferralEvents(100);
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
        description="پرداخت پاداش به دفترکل تولید از جاب دمو انجام نمی‌شود."
      />
      <OpsBadge state={enabled ? "SANDBOX" : "NOT_READY"} />
      <AdminNotice title="REFERRAL_ENABLED">{String(enabled)}</AdminNotice>
      <AdminTable
        headers={[
          "دعوت‌کننده",
          "دعوت‌شده",
          "پاداش دعوت‌کننده",
          "پاداش دعوت‌شده",
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
