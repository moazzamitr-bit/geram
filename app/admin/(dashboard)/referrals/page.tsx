import { AdminPageHeader, AdminTable } from "@/components/admin/AdminUI";
import { maskPhone } from "@/lib/admin/mask";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";
import { adminReferralOverview } from "@/lib/referral/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

const toman = (irr: string | number | null) => `${(Number(BigInt(String(irr ?? 0)) / 10n)).toLocaleString("fa-IR")} تومان`;

export default async function AdminReferralsPage() {
  const [{ totals, top, recent }, settings] = await Promise.all([adminReferralOverview(), loadCommerceSettings()]);
  const pct = Math.round(settings.referral.feeSharePercent * 100);
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="معرفی دوستان"
        description={`دعوت‌کننده‌ی احرازشده ${pct.toLocaleString("fa-IR")}٪ کارمزد هر معامله‌ی دوستش را همان لحظه از درآمد کارمزد (دفترکل) دریافت می‌کند.`}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["کاربران دعوت‌شده", totals.referred.toLocaleString("fa-IR")],
          ["تعداد پاداش", totals.rewards.toLocaleString("fa-IR")],
          ["کارمزد معاملات دعوت‌شده‌ها", toman(totals.fee_irr)],
          ["پاداش پرداخت‌شده", toman(totals.reward_irr)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-[#0F1724] p-4">
            <p className="text-[12px] text-white/50">{k}</p>
            <p className="mt-1 text-[18px] font-bold">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-white/50">
        درصد سهم در <Link className="text-gold" href="/admin/settings">تنظیمات کارمزد</Link> قابل تغییر است.
      </p>
      <h2 className="font-bold">برترین دعوت‌کننده‌ها</h2>
      <AdminTable headers={["کاربر", "کد", "دعوت‌شده", "پاداش"]} empty={top.length === 0}>
        {top.map((r) => (
          <tr key={String(r.id)} className="border-b border-white/5">
            <td className="px-4 py-3">
              <Link className="text-gold" href={`/admin/users/${r.id}`}>
                {[r.first_name, r.last_name].filter(Boolean).join(" ") || maskPhone(String(r.phone ?? ""))}
              </Link>
            </td>
            <td className="px-4 py-3 font-mono">{r.referral_code}</td>
            <td className="px-4 py-3">{Number(r.invited).toLocaleString("fa-IR")}</td>
            <td className="px-4 py-3">{toman(r.reward_irr)}</td>
          </tr>
        ))}
      </AdminTable>
      <h2 className="font-bold">آخرین پاداش‌ها</h2>
      <AdminTable headers={["زمان", "دعوت‌کننده", "دعوت‌شده", "معامله", "کارمزد", "سهم", "پاداش"]} empty={recent.length === 0}>
        {recent.map((r) => (
          <tr key={String(r.trade_id)} className="border-b border-white/5">
            <td className="px-4 py-3 text-[12px]">{new Date(String(r.created_at)).toLocaleString("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran" })}</td>
            <td className="px-4 py-3">{maskPhone(String(r.referrer_phone ?? ""))}</td>
            <td className="px-4 py-3">{maskPhone(String(r.referee_phone ?? ""))}</td>
            <td className="px-4 py-3 text-[12px]">{r.side} {r.asset}</td>
            <td className="px-4 py-3">{toman(r.fee_irr)}</td>
            <td className="px-4 py-3">{(Number(r.share_bps) / 100).toLocaleString("fa-IR")}٪</td>
            <td className="px-4 py-3">{toman(r.reward_irr)}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
