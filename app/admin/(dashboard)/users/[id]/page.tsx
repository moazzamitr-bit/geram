import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { PlanTierForm } from "@/components/admin/PlanTierForm";
import { WalletCreditForm } from "@/components/admin/WalletCreditForm";
import { isClosedBetaInactiveAdminPath } from "@/lib/admin/closed-beta";
import {
  getProfile,
  getUserBanks,
  getUserTickets,
  getUserTransactions,
} from "@/lib/admin/queries";
import { finnotechConfigured } from "@/lib/finnotech/config";
import { maskEmail, maskIban, maskPhone } from "@/lib/admin/mask";
import { DISPLAY_METALS, formatUgAsGrams } from "@/lib/ledger/display";
import { readHolderLedgerView } from "@/lib/ledger/read";
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
  const [ledger, txs, banks, tickets] = await Promise.all([
    readHolderLedgerView(id),
    getUserTransactions(id, 30),
    getUserBanks(id),
    getUserTickets(id),
  ]);

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";

  return (
    <div>
      <AdminPageHeader
        title={name}
        description="نمای ۳۶۰ مشتری. موجودی از دفترکل است. شارژ با ژورنال ثبت می‌شود."
        action={<AdminBadge tone={profile.role === "admin" ? "gold" : "neutral"}>{profile.role}</AdminBadge>}
      />
      <AdminNotice title="شارژ دفترکل">دکمه Edit Balance وجود ندارد. ثبت شارژ زیر همین حالا USER_AVAILABLE را در دفترکل زیاد می‌کند.</AdminNotice>
      <div className="mb-6 max-w-lg">
        <WalletCreditForm userId={id} lockUserId />
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[13px] leading-7">
          <h2 className="font-bold">پروفایل</h2>
          <p>شناسه داخلی: <span className="font-mono" dir="ltr">{profile.id}</span></p>
          <p>تلفن: <span dir="ltr">{maskPhone(profile.phone)}</span></p>
          <p>ایمیل: <span dir="ltr">{maskEmail(profile.email)}</span></p>
          <p>عضویت: {new Date(profile.created_at).toLocaleString("fa-IR")}</p>
          <p>پلن: {profile.plan_tier ?? "free"}</p>
          <p>سطح احراز: {profile.kyc_level ?? (profile.kyc_status === "VERIFIED" ? 1 : 0)}</p>
          <div className="mt-3">
            <PlanTierForm userId={id} current={profile.plan_tier ?? "free"} />
          </div>
          <p>کد رفرال: {profile.referral_code ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0F1724] p-5 text-[13px] leading-7">
          <h2 className="font-bold">KYC</h2>
          <p>
            وضعیت: <AdminBadge tone={profile.kyc_status === "VERIFIED" ? "positive" : "warning"}>{profile.kyc_status}</AdminBadge>
          </p>
          <p>
            هویت و مالکیت موبایل:{" "}
            {finnotechConfigured() ? "Finnotech تنظیم شده" : "Finnotech تنظیم نشده"}
          </p>
          {!isClosedBetaInactiveAdminPath(`/admin/kyc/${id}`) ? (
            <Link className="text-gold" href={`/admin/kyc/${id}`}>صف بررسی KYC</Link>
          ) : null}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-white/10 bg-[#0F1724] p-5">
        <h2 className="font-bold">موجودی دفترکل</h2>
        <p className="mt-1 text-[12px] text-white/45">
          تومان = ریال USER_AVAILABLE ÷ ۱۰. طلا، نقره و مس در دفترکل میکروگرم‌اند و اینجا گرم نشان داده می‌شوند.
        </p>
        {!ledger.ok ? (
          <AdminNotice title="دفترکل">{ledger.error}</AdminNotice>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[13px]">
            <p>تومان قابل استفاده: {formatToman(ledger.view.availableToman)}</p>
            <p>تومان رزرو: {formatToman(ledger.view.reservedToman)}</p>
            <p className="text-white/45">ریال قابل استفاده: {ledger.view.availableIrr.toLocaleString("fa-IR")}</p>
            <p className="text-white/45">ریال رزرو: {ledger.view.reservedIrr.toLocaleString("fa-IR")}</p>
            {DISPLAY_METALS.map((asset) => {
              const label = asset === "GOLD" ? "طلا" : asset === "SILVER" ? "نقره" : "مس";
              const metal = ledger.view.metals[asset];
              return (
                <div key={asset}>
                  <p>{label} قابل استفاده: {formatUgAsGrams(metal.availableUg)}</p>
                  <p>{label} رزرو: {formatUgAsGrams(metal.reservedUg)}</p>
                </div>
              );
            })}
          </div>
        )}
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
