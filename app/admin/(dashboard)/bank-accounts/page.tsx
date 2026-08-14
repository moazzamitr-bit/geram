import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { listBanks } from "@/lib/admin/queries";
import { maskIban, maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

function ownershipStatus(row: { verified?: boolean; account_status?: string | null }) {
  if (row.account_status === "DISABLED") return "DISABLED";
  if (row.verified) return "OWNERSHIP_VERIFIED";
  return "PENDING";
}

export default async function AdminBankAccountsPage() {
  const rows = await listBanks();
  return (
    <div>
      <AdminPageHeader
        title="حساب‌های بانکی"
        description="تأیید مالکیت واقعی NOT READY است. Mark verified آزادانه وجود ندارد."
      />
      <AdminNotice title="Provider">
        IBAN ownership = MOCK. Retry فقط audit می‌نویسد. تأیید دستی نیازمند maker-checker است و در این فاز رد می‌شود.
      </AdminNotice>
      <AdminTable
        headers={["کاربر", "بانک", "IBAN", "مالکیت", "وضعیت حساب", "ایجاد", "اقدام"]}
        empty={rows.length === 0}
      >
        {rows.map((b) => {
          const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
          const st = ownershipStatus(b);
          return (
            <tr key={b.id} className="border-b border-white/5 align-top">
              <td className="px-4 py-3">
                <Link className="text-gold" href={`/admin/users/${b.user_id}`}>
                  {profile
                    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone)
                    : b.user_id.slice(0, 8)}
                </Link>
              </td>
              <td className="px-4 py-3">{b.bank_name}</td>
              <td className="px-4 py-3 font-mono" dir="ltr">{maskIban(b.iban)}</td>
              <td className="px-4 py-3">
                <AdminBadge tone={st === "OWNERSHIP_VERIFIED" ? "positive" : "warning"}>{st}</AdminBadge>
              </td>
              <td className="px-4 py-3">{b.account_status ?? (b.verified ? "OWNERSHIP_VERIFIED" : "PENDING")}</td>
              <td className="px-4 py-3 text-white/45">{new Date(b.created_at).toLocaleDateString("fa-IR")}</td>
              <td className="px-4 py-3 min-w-[220px] space-y-2">
                <AdminActionForm action="retry" endpoint="/api/admin/bank" extra={{ accountId: b.id }} submitLabel="Retry verification" />
                <AdminActionForm action="resubmission" endpoint="/api/admin/bank" extra={{ accountId: b.id }} submitLabel="درخواست ارسال مجدد" />
                <AdminActionForm action="disable" endpoint="/api/admin/bank" extra={{ accountId: b.id }} submitLabel="غیرفعال" danger />
              </td>
            </tr>
          );
        })}
      </AdminTable>
      <div className="mt-4"><OpsBadge state="MOCK" /></div>
    </div>
  );
}
