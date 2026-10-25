import { AdminPageHeader, AdminTable } from "@/components/admin/AdminUI";
import { maskPhone } from "@/lib/admin/mask";
import { adminGiftOverview } from "@/lib/gift/service";
import Link from "next/link";

export const dynamic = "force-dynamic";

const METAL: Record<string, string> = { GOLD: "طلا", SILVER: "نقره", COPPER: "مس" };
const STATUS: Record<string, string> = { ACTIVE: "در انتظار", REDEEMED: "دریافت‌شده", CANCELLED: "لغو", EXPIRED: "منقضی" };
const g = (ug: unknown) => (Number(ug ?? 0) / 1e6).toLocaleString("fa-IR", { maximumFractionDigits: 4 });
const when = (v: unknown) => (v ? new Date(String(v)).toLocaleString("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran" }) : "—");
const name = (f: unknown, l: unknown, p: unknown) => [f, l].filter(Boolean).join(" ") || maskPhone(String(p ?? ""));

export default async function AdminGiftsPage() {
  const { totals, recent } = await adminGiftOverview();
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="کارت هدیه"
        description="فلز هدیه تا دریافت در USER_RESERVED فرستنده می‌ماند؛ دریافت، لغو یا انقضا (۳۰ روز، کرون) آن را جابه‌جا می‌کند."
      />
      <AdminTable headers={["وضعیت", "فلز", "تعداد", "مجموع (گرم)"]} empty={totals.length === 0}>
        {totals.map((t) => (
          <tr key={`${t.status}-${t.asset}`} className="border-b border-white/5">
            <td className="px-4 py-3">{STATUS[String(t.status)]}</td>
            <td className="px-4 py-3">{METAL[String(t.asset)]}</td>
            <td className="px-4 py-3">{Number(t.n).toLocaleString("fa-IR")}</td>
            <td className="px-4 py-3">{g(t.ug)}</td>
          </tr>
        ))}
      </AdminTable>
      <h2 className="font-bold">آخرین کارت‌ها</h2>
      <AdminTable headers={["ساخت", "کد", "فرستنده", "گیرنده", "مقدار", "وضعیت", "انقضا / تسویه"]} empty={recent.length === 0}>
        {recent.map((r) => (
          <tr key={String(r.id)} className="border-b border-white/5">
            <td className="px-4 py-3 text-[12px]">{when(r.created_at)}</td>
            <td className="px-4 py-3 font-mono text-[12px]">{String(r.code).slice(0, 8)}-••••</td>
            <td className="px-4 py-3">
              <Link className="text-gold" href={`/admin/users/${r.sender_id}`}>{name(r.sender_first, r.sender_last, r.sender_phone)}</Link>
            </td>
            <td className="px-4 py-3">
              {r.recipient_id ? (
                <Link className="text-gold" href={`/admin/users/${r.recipient_id}`}>{name(r.recipient_first, r.recipient_last, r.recipient_phone)}</Link>
              ) : "—"}
            </td>
            <td className="px-4 py-3">{g(r.weight_ug)} گرم {METAL[String(r.asset)]}</td>
            <td className="px-4 py-3">{STATUS[String(r.status)]}</td>
            <td className="px-4 py-3 text-[12px]">{r.settled_at ? when(r.settled_at) : when(r.expires_at)}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
