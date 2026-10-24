import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { listCoreTrades } from "@/lib/admin/ledger-activity";
import { formatToman } from "@/lib/utils";
import { maskPhone } from "@/lib/admin/mask";
import Link from "next/link";

export default async function AdminTradesPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string; side?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const trades = await listCoreTrades({ limit: 200 });
  const filtered = trades.filter((trade) => {
    if (sp.side === "BUY" && trade.type !== "خرید") return false;
    if (sp.side === "SELL" && trade.type !== "فروش") return false;
    if (sp.asset && String(trade.instrument ?? "") !== sp.asset) return false;
    if (sp.q) {
      const q = sp.q.toLowerCase();
      return trade.tracking_code.toLowerCase().includes(q) || trade.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <AdminPageHeader
        title="معاملات"
        description="تغییر دستی وضعیت SETTLED ممنوع است. فهرست از core_trades است."
        action={
          <a className="text-[13px] text-gold" href="/api/admin/export?type=trades">
            CSV
          </a>
        }
      />
      <AdminNotice title="منبع داده">
        core_trades. مبلغ خالص تومان است (ریال دفترکل ÷ ۱۰).
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
      <AdminTable headers={["کد", "کاربر", "نوع", "دارایی", "مبلغ", "وضعیت", "زمان"]} empty={filtered.length === 0}>
        {filtered.map((trade) => {
          const profile = trade.profiles;
          return (
            <tr key={trade.id} className="border-b border-white/5">
              <td className="px-4 py-3">
                <Link className="font-mono text-[12px] text-gold" href={`/admin/trades/${trade.id}`}>{trade.tracking_code}</Link>
              </td>
              <td className="px-4 py-3">
                {profile
                  ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone)
                  : trade.user_id.slice(0, 8)}
              </td>
              <td className="px-4 py-3">{trade.type}</td>
              <td className="px-4 py-3">{trade.instrument ?? "—"}</td>
              <td className="px-4 py-3">{formatToman(trade.amount_toman)}</td>
              <td className="px-4 py-3"><AdminBadge>{trade.status}</AdminBadge></td>
              <td className="px-4 py-3 text-white/45">{new Date(trade.created_at).toLocaleString("fa-IR")}</td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
