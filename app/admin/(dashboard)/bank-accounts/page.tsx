import { AdminBadge, AdminNotice, AdminPageHeader, AdminTable } from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { listBanks } from "@/lib/admin/queries";
import { maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

export default async function AdminBankAccountsPage() {
  const rows = await listBanks();
  return (
    <div>
      <AdminPageHeader
        title="کارت‌ها و شباهای بانکی"
        description="تنها منبع اطلاعات بانکی کاربران: کارت با استعلام مالکیت فینوتک تأیید می‌شود و شبا با استعلام کارت‌به‌شبا گرفته می‌شود. ورود دستی شبا وجود ندارد."
      />
      <AdminNotice title="برداشت">برداشت تومانی فقط به شبای کارت VERIFIED همان کاربر ممکن است.</AdminNotice>
      <AdminTable headers={["کاربر", "بانک", "کارت", "شبا", "صاحب حساب", "وضعیت", "اقدام"]} empty={rows.length === 0}>
        {rows.map((b) => {
          const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
          return (
            <tr key={b.id} className="border-b border-white/5 align-top">
              <td className="px-4 py-3">
                <Link className="text-gold" href={`/admin/users/${b.user_id}`}>
                  {profile
                    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone)
                    : String(b.user_id).slice(0, 8)}
                </Link>
              </td>
              <td className="px-4 py-3">{b.iban_bank_name ?? b.bank_name}</td>
              <td className="px-4 py-3 font-mono" dir="ltr">{b.pan_masked}</td>
              <td className="px-4 py-3 font-mono text-[12px]" dir="ltr">{b.iban ?? "—"}</td>
              <td className="px-4 py-3 text-[12px]">{b.iban_owners ?? "—"}</td>
              <td className="px-4 py-3">
                <AdminBadge tone={b.status === "VERIFIED" ? (b.iban ? "positive" : "warning") : "neutral"}>
                  {b.status === "VERIFIED" ? (b.iban ? "تأیید + شبا" : "تأیید، بدون شبا") : "غیرفعال"}
                </AdminBadge>
              </td>
              <td className="px-4 py-3 min-w-[220px]">
                {b.status === "VERIFIED" ? (
                  <AdminActionForm action="disable" endpoint="/api/admin/bank" extra={{ cardId: b.id }} submitLabel="غیرفعال" danger />
                ) : "—"}
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
