import {
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { listWallets } from "@/lib/db/admin-queries";
import { probeTable } from "@/lib/admin/probe";
import { recomputeFromJournal } from "@/lib/admin/queries";
import { formatToman } from "@/lib/utils";
import { maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; journal?: string }>;
}) {
  const sp = await searchParams;
  const wallets = await listWallets(150);
  const accounts = await probeTable<Record<string, unknown>>("core_ledger_accounts", "*", { limit: 200 });
  const journals = await probeTable<Record<string, unknown>>("core_journals", "*", {
    order: "created_at",
    limit: 80,
  });
  const recompute = sp.user ? await recomputeFromJournal(sp.user) : null;

  return (
    <div>
      <AdminPageHeader
        title="کاوشگر دفترکل"
        description="فقط خواندنی. Recompute از ژورنال تشخیصی است. دکمه ویرایش موجودی وجود ندارد."
      />
      <AdminNotice title="ممنوع">Edit Balance / mutation مستقیم wallets.balance وجود ندارد.</AdminNotice>
      {!accounts.ready ? (
        <AdminNotice title="core_ledger_accounts">
          {accounts.error ?? "NOT READY"}. موجودی‌های زیر از جدول میراث wallets است و بدهی دفترکل محسوب نمی‌شود.
        </AdminNotice>
      ) : (
        <OpsBadge state="SANDBOX" />
      )}

      <form className="mb-4 flex flex-wrap gap-2" action="/admin/ledger">
        <input
          name="user"
          defaultValue={sp.user ?? ""}
          placeholder="user id برای recompute"
          className="h-10 w-72 rounded-xl border border-white/10 bg-[#0B1220] px-3 text-[13px]"
        />
        <button className="text-gold text-[13px]" type="submit">Recompute from journal</button>
      </form>

      {recompute && !recompute.ready ? (
        <AdminNotice title="Recompute">{recompute.error} — NOT READY</AdminNotice>
      ) : null}
      {recompute && recompute.ready ? (
        <div className="mb-6 rounded-2xl border border-white/10 bg-[#0F1724] p-4">
          {recompute.mismatch ? (
            <p className="font-bold text-negative">CRITICAL mismatch — موجودی کش با ژورنال یکی نیست</p>
          ) : (
            <p className="text-positive">کش با جمع ژورنال یکی است (برای حساب‌های موجود).</p>
          )}
          <AdminTable headers={["حساب", "دارایی", "کش", "مشتق"]} empty={recompute.cached.length === 0}>
            {recompute.cached.map((r) => (
              <tr key={`${r.account}:${r.asset}`} className="border-b border-white/5">
                <td className="px-4 py-3">{r.account}</td>
                <td className="px-4 py-3">{r.asset}</td>
                <td className="px-4 py-3">{r.cached.toLocaleString("fa-IR")}</td>
                <td className="px-4 py-3">{r.derived.toLocaleString("fa-IR")}</td>
              </tr>
            ))}
          </AdminTable>
        </div>
      ) : null}

      <h2 className="mb-3 font-bold">موجودی میراث wallets</h2>
      <AdminTable
        headers={["کاربر", "IRR", "طلا", "نقره", "مس", "دفترکل"]}
        empty={wallets.length === 0}
      >
        {wallets.map((w) => {
          const profile = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles;
          return (
            <tr key={w.id} className="border-b border-white/5">
              <td className="px-4 py-3">
                <Link className="text-gold" href={`/admin/users/${w.user_id}`}>
                  {profile
                    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone)
                    : w.user_id.slice(0, 8)}
                </Link>
              </td>
              <td className="px-4 py-3">{formatToman(Number(w.toman_available))}</td>
              <td className="px-4 py-3">{(Number(w.gold_mg) / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })}</td>
              <td className="px-4 py-3">{(Number((w as { silver_mg?: number }).silver_mg ?? 0) / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })}</td>
              <td className="px-4 py-3">{(Number((w as { copper_mg?: number }).copper_mg ?? 0) / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 3 })}</td>
              <td className="px-4 py-3">
                <Link className="text-[12px] text-gold" href={`/admin/ledger?user=${w.user_id}`}>recompute</Link>
              </td>
            </tr>
          );
        })}
      </AdminTable>

      <h2 className="mb-3 mt-8 font-bold">ژورنال‌ها</h2>
      {journals.ready ? (
        <AdminTable headers={["id", "reason", "ref", "زمان"]} empty={journals.rows.length === 0}>
          {journals.rows.map((j) => (
            <tr key={String(j.id)} className="border-b border-white/5">
              <td className="px-4 py-3 font-mono text-[12px]">{String(j.id).slice(0, 12)}</td>
              <td className="px-4 py-3">{String(j.reason)}</td>
              <td className="px-4 py-3">{String(j.ref_type)}/{String(j.ref_id)}</td>
              <td className="px-4 py-3 text-white/45">{new Date(String(j.created_at)).toLocaleString("fa-IR")}</td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <p className="text-[13px] text-white/45">core_journals: NOT READY — {journals.error}</p>
      )}
    </div>
  );
}
