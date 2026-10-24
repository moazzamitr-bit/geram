import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listProfiles } from "@/lib/db/admin-queries";
import { maskEmail, maskPhone } from "@/lib/admin/mask";
import { maskNationalCode } from "@/lib/kyc/national-id";
import { finnotechConfigured } from "@/lib/finnotech/config";
import Link from "next/link";

const MAP: Record<string, string> = {
  UNVERIFIED: "NOT_STARTED",
  PENDING: "REVIEW_REQUIRED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  NEEDS_UPDATE: "REVIEW_REQUIRED",
};

function when(value: unknown) {
  if (!value || typeof value !== "string") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fa-IR");
}

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
  const configured = finnotechConfigured();

  return (
    <div>
      <AdminPageHeader
        title="صف KYC"
        description="نتیجه شاهکار و استعلام ثبت احوال روی پرونده ذخیره می‌شود. توکن فینوتک ذخیره نمی‌شود."
      />
      <AdminNotice title="فینوتک">
        {configured
          ? "اتصال فینوتک روشن است. نام، وضعیت، زمان تأیید و شناسه پیگیری از پاسخ سرویس می‌آید. کد ملی در این فهرست ماسک است."
          : "کلید فینوتک در محیط سرور نیست. پرونده‌های قبلی نشان داده می‌شوند؛ استعلام جدید تا تنظیم کلید انجام نمی‌شود."}
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
      <AdminTable
        headers={["کاربر", "تماس", "کد ملی", "سطح", "وضعیت", "حساب", "زمان تأیید", "سرویس", "صف"]}
        empty={filtered.length === 0}
      >
        {filtered.map((u) => {
          const row = u as typeof u & {
            national_code?: string | null;
            kyc_verified_at?: string | null;
            kyc_provider?: string | null;
            kyc_level?: number | null;
            kyc_bank_mask?: string | null;
          };
          return (
            <tr key={u.id} className="border-b border-white/5">
              <td className="px-4 py-3">
                <Link className="text-gold" href={`/admin/kyc/${u.id}`}>
                  {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                </Link>
              </td>
              <td className="px-4 py-3" dir="ltr">{maskPhone(u.phone)} · {maskEmail(u.email)}</td>
              <td className="px-4 py-3" dir="ltr">{row.national_code ? maskNationalCode(row.national_code) : "—"}</td>
              <td className="px-4 py-3">{row.kyc_level ?? (u.kyc_status === "VERIFIED" ? 1 : 0)}</td>
              <td className="px-4 py-3">
                <AdminBadge tone={u.kyc_status === "VERIFIED" ? "positive" : u.kyc_status === "REJECTED" ? "negative" : "warning"}>
                  {MAP[u.kyc_status] ?? u.kyc_status}
                </AdminBadge>
              </td>
              <td className="px-4 py-3 text-white/70">{row.kyc_bank_mask || "—"}</td>
              <td className="px-4 py-3 text-white/70">{when(row.kyc_verified_at)}</td>
              <td className="px-4 py-3 text-white/45">{row.kyc_provider || "—"}</td>
              <td className="px-4 py-3">
                <Link className="text-[12px] text-gold" href={`/admin/kyc/${u.id}`}>بررسی</Link>
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
