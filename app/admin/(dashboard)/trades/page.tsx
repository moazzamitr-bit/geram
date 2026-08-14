import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
  OpsBadge,
} from "@/components/admin/AdminUI";
import { probeTable } from "@/lib/admin/probe";
import { listTransactionsFiltered } from "@/lib/admin/queries";
import { formatToman } from "@/lib/utils";
import { maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

export default async function AdminTradesPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string; side?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const core = await probeTable<Record<string, unknown>>("core_trades", "*", {
    order: "created_at",
    limit: 200,
  });
  const legacy = await listTransactionsFiltered({ limit: 200 });
  const trades = legacy.filter((t) => t.type === "خرید" || t.type === "فروش");
  const filtered = trades.filter((t) => {
    if (sp.side === "BUY" && t.type !== "خرید") return false;
    if (sp.side === "SELL" && t.type !== "فروش") return false;
    if (sp.asset && String(t.instrument ?? "gold18") !== sp.asset) return false;
    if (sp.q) {
      const q = sp.q.toLowerCase();
      return String(t.tracking_code).toLowerCase().includes(q) || String(t.id).includes(q);
    }
    return true;
  });

  return (
    <div>
      <AdminPageHeader
        title="معاملات"
        description="تغییر دستی وضعیت SETTLED ممنوع است. اقدام کنترل‌شده: باز کردن حادثه / مشاهده تطبیق."
        action={
          <a className="text-[13px] text-gold" href="/api/admin/export?type=trades">
            CSV
          </a>
        }
      />
      {core.ready ? <OpsBadge state="SANDBOX" /> : <OpsBadge state="NOT_READY" />}
      <AdminNotice title="منبع داده">
        {core.ready
          ? `جدول core_trades موجود است (${core.rows.length} ردیف).`
          : `core_trades روی این دیتابیس نیست (${core.error ?? "NOT READY"}). فهرست زیر از جدول میراث transactions است.`}
      </AdminNotice>
      <form className="mb-4 flex flex-wrap gap-2 text-[13px]" action="/admin/trades">
        <select name="asset" defaultValue={sp.asset ?? ""} className="h-10 rounded-xl border border-white/10 bg-[#0B1220] px-3">
          <option value="">همه دارایی‌ها</option>
          <option value="gold18">GOLD</option>
          <option value="silver925">SILVER</option>
          <option value="copper">COPPER</option>
        </select>
        <select name="side" defaultValue={sp.side ?? ""} className="h-10 rounded-xl border border-white/10 bg-[#0B1220] px-3">
          <option value="">خرید/فروش</option>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="کد پیگیری / id" className="h-10 rounded-xl border border-white/10 bg-[#0B1220] px-3" />
        <button className="text-gold" type="submit">فیلتر</button>
      </form>
      {core.ready && core.rows.length > 0 ? (
        <AdminTable headers={["Trade ID", "کاربر", "دارایی", "سمت", "وضعیت", "خالص", "زمان"]} empty={false}>
          {core.rows.map((t) => (
            <tr key={String(t.id)} className="border-b border-white/5">
              <td className="px-4 py-3">
                <Link className="font-mono text-[12px] text-gold" href={`/admin/trades/${t.id}`}>{String(t.id).slice(0, 12)}</Link>
              </td>
              <td className="px-4 py-3 font-mono text-[12px]">{String(t.user_id).slice(0, 8)}</td>
              <td className="px-4 py-3">{String(t.asset)}</td>
              <td className="px-4 py-3">{String(t.side)}</td>
              <td className="px-4 py-3"><AdminBadge>{String(t.status)}</AdminBadge></td>
              <td className="px-4 py-3">{formatToman(Number(t.net_irr ?? 0))}</td>
              <td className="px-4 py-3 text-white/45">{new Date(String(t.created_at)).toLocaleString("fa-IR")}</td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <AdminTable headers={["کد", "کاربر", "نوع", "دارایی", "مبلغ", "وضعیت", "زمان"]} empty={filtered.length === 0}>
          {filtered.map((t) => {
            const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
            return (
              <tr key={t.id} className="border-b border-white/5">
                <td className="px-4 py-3">
                  <Link className="font-mono text-[12px] text-gold" href={`/admin/trades/${t.id}`}>{t.tracking_code}</Link>
                </td>
                <td className="px-4 py-3">{profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone) : "—"}</td>
                <td className="px-4 py-3">{t.type}</td>
                <td className="px-4 py-3">{t.instrument ?? "gold18"}</td>
                <td className="px-4 py-3">{formatToman(Number(t.amount_toman))}</td>
                <td className="px-4 py-3"><AdminBadge>{t.status}</AdminBadge></td>
                <td className="px-4 py-3 text-white/45">{new Date(t.created_at).toLocaleString("fa-IR")}</td>
              </tr>
            );
          })}
        </AdminTable>
      )}
    </div>
  );
}
