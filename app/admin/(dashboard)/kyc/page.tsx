import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listProfiles } from "@/lib/db/admin-queries";
import { maskEmail, maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

const MAP: Record<string, string> = {
  UNVERIFIED: "NOT_STARTED",
  PENDING: "REVIEW_REQUIRED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  NEEDS_UPDATE: "REVIEW_REQUIRED",
};

export default async function AdminKycQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listProfiles(400);
  const filtered = sp.status
    ? rows.filter((u) => (MAP[u.kyc_status] ?? u.kyc_status) === sp.status)
    : rows;

  return (
    <div>
      <AdminPageHeader
        title="صف KYC"
        description="بررسی دستی با audit. تأیید VERIFIED فقط با مجوز kyc.approve_verified و دلیل."
      />
      <AdminNotice title="فروشنده KYC">
        PROVIDER_PENDING / استعلام هویت واقعی NOT READY است. Retry provider ثبت audit می‌کند ولی فراخوان خارجی ندارد.
      </AdminNotice>
      <div className="mb-4 flex flex-wrap gap-2 text-[12px]">
        {["", "NOT_STARTED", "REVIEW_REQUIRED", "VERIFIED", "REJECTED"].map((s) => (
          <Link
            key={s || "all"}
            href={s ? `/admin/kyc?status=${s}` : "/admin/kyc"}
            className="rounded-full border border-white/10 px-3 py-1 text-white/70 hover:text-gold"
          >
            {s || "همه"}
          </Link>
        ))}
      </div>
      <AdminTable headers={["کاربر", "تماس", "وضعیت عملیاتی", "خام", "صف"]} empty={filtered.length === 0}>
        {filtered.map((u) => (
          <tr key={u.id} className="border-b border-white/5">
            <td className="px-4 py-3">
              <Link className="text-gold" href={`/admin/kyc/${u.id}`}>
                {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
              </Link>
            </td>
            <td className="px-4 py-3" dir="ltr">{maskPhone(u.phone)} · {maskEmail(u.email)}</td>
            <td className="px-4 py-3">
              <AdminBadge tone={u.kyc_status === "VERIFIED" ? "positive" : u.kyc_status === "REJECTED" ? "negative" : "warning"}>
                {MAP[u.kyc_status] ?? u.kyc_status}
              </AdminBadge>
            </td>
            <td className="px-4 py-3 text-white/45">{u.kyc_status}</td>
            <td className="px-4 py-3">
              <Link className="text-[12px] text-gold" href={`/admin/kyc/${u.id}`}>بررسی</Link>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
