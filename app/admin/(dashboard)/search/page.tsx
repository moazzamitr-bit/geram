import {
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { searchOps } from "@/lib/admin/queries";
import { maskEmail, maskIban, maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const result = await searchOps(q);

  return (
    <div>
      <AdminPageHeader title="جستجوی عملیاتی" description="جستجوی حساس نیازمند search.sensitive در APIهای بعدی است. PII ماسک می‌شود." />
      <form className="mb-6" action="/admin/search">
        <input
          name="q"
          defaultValue={q}
          placeholder="user id، کد پیگیری، تیکت، IBAN last4، journal…"
          className="h-11 w-full max-w-xl rounded-xl border border-white/10 bg-[#0B1220] px-4 text-[13px]"
        />
      </form>
      {!q.trim() ? (
        <AdminNotice title="عبارت را وارد کنید">از هدر کنسول هم می‌توانید جستجو کنید.</AdminNotice>
      ) : (
        <>
          <h2 className="mb-2 font-bold">کاربران</h2>
          <AdminTable headers={["نام", "تماس", "KYC"]} empty={result.users.length === 0}>
            {result.users.map((u) => (
              <tr key={u.id} className="border-b border-white/5">
                <td className="px-4 py-3">
                  <Link className="text-gold" href={`/admin/users/${u.id}`}>
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3" dir="ltr">{maskPhone(u.phone)} · {maskEmail(u.email)}</td>
                <td className="px-4 py-3">{u.kyc_status}</td>
              </tr>
            ))}
          </AdminTable>
          <h2 className="mb-2 mt-6 font-bold">تراکنش‌ها</h2>
          <AdminTable headers={["کد", "نوع", "وضعیت"]} empty={result.txs.length === 0}>
            {result.txs.map((t) => (
              <tr key={t.id} className="border-b border-white/5">
                <td className="px-4 py-3">
                  <Link className="font-mono text-[12px] text-gold" href={`/admin/trades/${t.id}`}>{t.tracking_code}</Link>
                </td>
                <td className="px-4 py-3">{t.type}</td>
                <td className="px-4 py-3">{t.status}</td>
              </tr>
            ))}
          </AdminTable>
          <h2 className="mb-2 mt-6 font-bold">تیکت‌ها</h2>
          <AdminTable headers={["موضوع", "وضعیت"]} empty={result.tickets.length === 0}>
            {result.tickets.map((t) => (
              <tr key={t.id} className="border-b border-white/5">
                <td className="px-4 py-3">
                  <Link className="text-gold" href={`/admin/support/${t.id}`}>{t.subject}</Link>
                </td>
                <td className="px-4 py-3">{t.status}</td>
              </tr>
            ))}
          </AdminTable>
          <h2 className="mb-2 mt-6 font-bold">حساب بانکی (last4)</h2>
          <AdminTable headers={["IBAN", "بانک"]} empty={result.banks.length === 0}>
            {result.banks.map((b) => (
              <tr key={b.id} className="border-b border-white/5">
                <td className="px-4 py-3 font-mono" dir="ltr">{maskIban(b.iban)}</td>
                <td className="px-4 py-3">{b.bank_name}</td>
              </tr>
            ))}
          </AdminTable>
          <h2 className="mb-2 mt-6 font-bold">ژورنال</h2>
          {result.journalsReady === false ? (
            <p className="text-[13px] text-white/45">core_journals NOT READY</p>
          ) : (
            <AdminTable headers={["id", "ref"]} empty={result.journals.length === 0}>
              {result.journals.map((j) => (
                <tr key={j.id} className="border-b border-white/5">
                  <td className="px-4 py-3 font-mono text-[12px]">{j.id}</td>
                  <td className="px-4 py-3">{j.ref_type}/{j.ref_id}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </>
      )}
    </div>
  );
}
