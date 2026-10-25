import { AdminPageHeader, AdminTable } from "@/components/admin/AdminUI";
import { maskPhone } from "@/lib/admin/mask";
import { adminSavingsOverview } from "@/lib/savings/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown> & { profiles?: { first_name?: string; last_name?: string; phone?: string } | null };

const CAD: Record<string, string> = { DAILY: "روزانه", WEEKLY: "هفتگی", MONTHLY: "ماهانه" };
const METAL: Record<string, string> = { GOLD: "طلا", SILVER: "نقره", COPPER: "مس" };
const STATUS: Record<string, string> = {
  ACTIVE: "فعال",
  PAUSED: "متوقف",
  CANCELLED: "لغو",
  SUCCESS: "موفق",
  FAILED: "ناموفق",
  RUNNING: "در حال اجرا",
};
const when = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran" }) : "—";
const who = (r: Row) =>
  [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(" ") || maskPhone(String(r.profiles?.phone ?? ""));

export default async function AdminSavingsPage() {
  const { plans, runs } = (await adminSavingsOverview()) as { plans: Row[]; runs: Row[] };
  const active = plans.filter((p) => p.status === "ACTIVE");
  const monthlyToman = active.reduce((sum, p) => {
    const per = { DAILY: 30, WEEKLY: 30 / 7, MONTHLY: 1 }[String(p.cadence)] ?? 0;
    return sum + Number(p.amount_toman) * per;
  }, 0);
  const ok = runs.filter((r) => r.status === "SUCCESS").length;
  const failed = runs.filter((r) => r.status === "FAILED").length;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="طرح پس‌انداز"
        description="خریدهای دوره‌ای کاربران؛ کرون سرور هر ۱۵ دقیقه نوبت‌های سررسیده را از مسیر عادی معامله و دفترکل اجرا می‌کند."
      />
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["طرح فعال", active.length.toLocaleString("fa-IR")],
          ["خرید ماهانه‌ی تقریبی", `${Math.round(monthlyToman).toLocaleString("fa-IR")} تومان`],
          ["نوبت موفق (۱۰۰ آخر)", ok.toLocaleString("fa-IR")],
          ["نوبت ناموفق (۱۰۰ آخر)", failed.toLocaleString("fa-IR")],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-[#0F1724] p-4">
            <p className="text-[12px] text-white/50">{k}</p>
            <p className="mt-1 text-[18px] font-bold">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-white/50">
        سقف تعداد طرح فعال در <Link className="text-gold" href="/admin/settings">تنظیمات</Link> قابل تغییر است.
      </p>
      <h2 className="font-bold">طرح‌ها</h2>
      <AdminTable headers={["کاربر", "فلز", "دوره", "مبلغ", "وضعیت", "نوبت بعدی", "آخرین خرید", "شکست پیاپی"]} empty={plans.length === 0}>
        {plans.map((p) => (
          <tr key={String(p.id)} className="border-b border-white/5">
            <td className="px-4 py-3">
              <Link className="text-gold" href={`/admin/users/${p.user_id}`}>{who(p)}</Link>
            </td>
            <td className="px-4 py-3">{METAL[String(p.asset)]}</td>
            <td className="px-4 py-3">{CAD[String(p.cadence)]}</td>
            <td className="px-4 py-3">{Number(p.amount_toman).toLocaleString("fa-IR")} تومان</td>
            <td className="px-4 py-3">{STATUS[String(p.status)]}</td>
            <td className="px-4 py-3 text-[12px]">{p.status === "ACTIVE" ? when(p.next_run_at) : "—"}</td>
            <td className="px-4 py-3 text-[12px]">{when(p.last_run_at)}</td>
            <td className="px-4 py-3">{Number(p.fail_streak ?? 0).toLocaleString("fa-IR")}</td>
          </tr>
        ))}
      </AdminTable>
      <h2 className="font-bold">آخرین نوبت‌ها</h2>
      <AdminTable headers={["نوبت", "کاربر", "وضعیت", "مبلغ", "وزن (گرم)", "کارمزد", "معامله / خطا"]} empty={runs.length === 0}>
        {runs.map((r) => (
          <tr key={String(r.id)} className="border-b border-white/5">
            <td className="px-4 py-3 text-[12px]">{when(r.run_for)}</td>
            <td className="px-4 py-3">{who(r)}</td>
            <td className="px-4 py-3">{STATUS[String(r.status)]}</td>
            <td className="px-4 py-3">{r.amount_irr ? `${(Number(r.amount_irr) / 10).toLocaleString("fa-IR")} تومان` : "—"}</td>
            <td className="px-4 py-3">{r.weight_ug ? (Number(r.weight_ug) / 1e6).toLocaleString("fa-IR", { maximumFractionDigits: 4 }) : "—"}</td>
            <td className="px-4 py-3">{r.fee_irr ? `${(Number(r.fee_irr) / 10).toLocaleString("fa-IR")} تومان` : "—"}</td>
            <td className="px-4 py-3 text-[12px]">{r.trade_id ? <span className="font-mono text-[11px]">{String(r.trade_id)}</span> : String(r.error ?? "")}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
