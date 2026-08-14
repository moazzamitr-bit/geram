import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import {
  getProfile,
  getUserBanks,
  getUserTickets,
  getUserTransactions,
  getWallet,
} from "@/lib/admin/queries";
import { maskEmail, maskIban, maskPhone } from "@/lib/admin/mask";
import { formatToman } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function AdminUser360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const [wallet, txs, banks, tickets] = await Promise.all([
    getWallet(id),
    getUserTransactions(id, 30),
    getUserBanks(id),
    getUserTickets(id),
  ]);

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";

  return (
    <div>
      <AdminPageHeader
        title={name}
        description="نمای ۳۶۰ مشتری. ویرایش موجودی وجود ندارد."
        action={<AdminBadge tone={profile.role === "admin" ? "gold" : "neutral"}>{profile.role}</AdminBadge>}
      />
      <AdminNotice title="ممنوع">دکمه Edit Balance / تغییر مستقیم موجودی وجود ندارد. اصلاح مالی فقط از مسیر journal و maker-checker.</AdminNotice>

      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[13px] leading-7">
          <h2 className="font-bold">پروفایل</h2>
          <p>شناسه داخلی: <span className="font-mono" dir="ltr">{profile.id}</span></p>
          <p>تلفن: <span dir="ltr">{maskPhone(profile.phone)}</span></p>
          <p>ایمیل: <span dir="ltr">{maskEmail(profile.email)}</span></p>
          <p>عضویت: {new Date(profile.created_at).toLocaleString("fa-IR")}</p>
          <p>پلن: {profile.plan_tier ?? "free"}</p>
          <p>کد رفرال: {profile.referral_code ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[13px] leading-7">
          <h2 className="font-bold">KYC</h2>
          <p>
            وضعیت: <AdminBadge tone={profile.kyc_status === "VERIFIED" ? "positive" : "warning"}>{profile.kyc_status}</AdminBadge>
          </p>
          <p>هویت / مالکیت موبایل / مالکیت حساب: <span className="text-white/45">NOT READY (فروشنده KYC نیست)</span></p>
          <Link className="text-gold" href={`/admin/kyc/${id}`}>صف بررسی KYC</Link>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-white/10 bg-[#0F1724] p-5">
        <h2 className="font-bold">مالی (جدول wallets — میراث)</h2>
        <p className="mt-1 text-[12px] text-white/45">رزرو دفترکل عملیاتی در این محیط موجود نیست.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[13px]">
          <p>IRR موجود: {formatToman(Number(wallet?.toman_available ?? 0))}</p>
          <p>IRR رزرو/انتظار: {formatToman(Number(wallet?.toman_pending ?? 0))}</p>
          <p>طلا: {(Number(wallet?.gold_mg ?? 0) / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم</p>
          <p>نقره: {(Number(wallet?.silver_mg ?? 0) / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم</p>
          <p>مس: {(Number(wallet?.copper_mg ?? 0) / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })} گرم</p>
          <p>رزرو فلز: داده در دسترس نیست</p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 font-bold">حساب‌های بانکی</h2>
        <AdminTable headers={["بانک", "IBAN", "مالکیت", "ایجاد"]} empty={banks.length === 0}>
          {banks.map((b) => (
            <tr key={b.id} className="border-b border-white/5">
              <td className="px-4 py-3">{b.bank_name}</td>
              <td className="px-4 py-3 font-mono" dir="ltr">{maskIban(b.iban)}</td>
              <td className="px-4 py-3">
                <AdminBadge tone={b.verified ? "positive" : "warning"}>
                  {b.verified ? "OWNERSHIP_VERIFIED" : "PENDING"}
                </AdminBadge>
              </td>
              <td className="px-4 py-3 text-white/45">{new Date(b.created_at).toLocaleDateString("fa-IR")}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 font-bold">فعالیت اخیر</h2>
        <AdminTable headers={["کد", "نوع", "مبلغ", "وضعیت", "زمان"]} empty={txs.length === 0}>
          {txs.map((t) => (
            <tr key={t.id} className="border-b border-white/5">
              <td className="px-4 py-3 font-mono text-[12px]">
                <Link className="text-gold" href={`/admin/trades/${t.id}`}>{t.tracking_code}</Link>
              </td>
              <td className="px-4 py-3">{t.type}</td>
              <td className="px-4 py-3">{formatToman(Number(t.amount_toman))}</td>
              <td className="px-4 py-3">{t.status}</td>
              <td className="px-4 py-3 text-white/45">{new Date(t.created_at).toLocaleString("fa-IR")}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 font-bold">تیکت‌ها</h2>
        <AdminTable headers={["موضوع", "وضعیت"]} empty={tickets.length === 0}>
          {tickets.map((t) => (
            <tr key={t.id} className="border-b border-white/5">
              <td className="px-4 py-3">
                <Link className="text-gold" href={`/admin/support/${t.id}`}>{t.subject}</Link>
              </td>
              <td className="px-4 py-3">{t.status}</td>
            </tr>
          ))}
        </AdminTable>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 font-bold">امنیت / نشست</h2>
          <AdminNotice title="نشست‌ها و دستگاه">لیست دستگاه از auth.sessions در این فاز NOT READY است. لغو همه نشست‌ها در صورت دسترسی سرویس‌رول ممکن است.</AdminNotice>
          <AdminActionForm
            action="revoke_sessions"
            endpoint="/api/admin/sessions/revoke"
            extra={{ userId: id }}
            submitLabel="لغو همه نشست‌ها"
            danger
          />
        </div>
      </section>
    </div>
  );
}
